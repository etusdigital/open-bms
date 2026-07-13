import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContactEntity } from '../../entities/contact.entity';
import { EnterpriseImportJobEntity } from '../../entities/enterprise-import-job.entity';
import { EmailReconcileItemEntity, EmailReconcileStoredCandidate } from '../../entities/email-reconcile-item.entity';
import { EmailReconcileSessionEntity } from '../../entities/email-reconcile-session.entity';
import { AMBIGUOUS_CANDIDATES_LIMIT, EmailReconcileService } from './email-reconcile.service';
import type {
  AmbiguousPageResult,
  ApplyAutoChunkResult,
  ApplyResolution,
  BulkResolveResult,
  ReconcileItemsPage,
  ReconcileSessionProgress,
  ResolveBatchResult,
} from './email-reconcile.types';

const NO_MATCH_SAMPLE_LIMIT = 50;
const INSERT_CHUNK = 1000;

/**
 * Batched reconciliation over a persisted working set.
 *
 * The stateless preview/apply flow collapses on real Enterprise exports:
 * 350k contacts yield tens of thousands of ambiguous matches, and both the
 * response payload and the single all-or-nothing apply become unmanageable.
 *
 * Here the CSV is parsed and matched ONCE (createSession) and the outcome is
 * persisted — one item per matched contact. From then on everything is
 * incremental and quantified:
 *   - auto items are applied in operator-sized chunks (applyAutoChunk),
 *   - ambiguous items are reviewed in pages (getAmbiguousPage + resolveBatch),
 *   - bulk strategies (best-name / skip-remaining) clear the long tail.
 * Progress is derivable at any point from item statuses, so the operator can
 * leave and resume without re-uploading the CSV.
 */
@Injectable()
export class EmailReconcileSessionService {
  private readonly logger = new Logger(EmailReconcileSessionService.name);

  constructor(
    private readonly reconcileService: EmailReconcileService,
    @InjectRepository(ContactEntity)
    private readonly contactsRepo: Repository<ContactEntity>,
    @InjectRepository(EnterpriseImportJobEntity)
    private readonly jobsRepo: Repository<EnterpriseImportJobEntity>,
    @InjectRepository(EmailReconcileSessionEntity)
    private readonly sessionsRepo: Repository<EmailReconcileSessionEntity>,
    @InjectRepository(EmailReconcileItemEntity)
    private readonly itemsRepo: Repository<EmailReconcileItemEntity>,
  ) {}

  async createSession(jobId: string, csv: string, ignoreColumns: string[] = []): Promise<ReconcileSessionProgress> {
    const job = await this.requireJob(jobId);
    const computation = await this.reconcileService.computeReconciliation(csv, job.accountId!, ignoreColumns);

    // Replace any previous working set — items cascade with the session row.
    await this.sessionsRepo.delete({ jobId });
    await this.sessionsRepo.insert({
      jobId,
      accountId: job.accountId!,
      csvRows: computation.csvRows,
      invalidCsvRows: computation.invalidCsvRows,
      contactsMasked: computation.contactsMasked,
      alreadyClean: computation.alreadyClean,
      noMatchTotal: computation.noMatches.length,
      noMatchSample: computation.noMatches.slice(0, NO_MATCH_SAMPLE_LIMIT),
    });

    const items: Array<Partial<EmailReconcileItemEntity>> = [
      ...computation.matches.map((m) => ({
        jobId,
        contactId: m.contactId,
        currentEmail: m.currentEmail,
        contactName: m.contactName || null,
        kind: 'auto' as const,
        status: 'pending' as const,
        newEmail: m.newEmail,
        csvRowNumber: m.csvRowNumber,
      })),
      ...computation.ambiguous.map((a) => ({
        jobId,
        contactId: a.contactId,
        currentEmail: a.currentEmail,
        contactName: a.contactName || null,
        kind: 'ambiguous' as const,
        status: 'pending' as const,
        candidates: a.candidates.slice(0, AMBIGUOUS_CANDIDATES_LIMIT) as EmailReconcileStoredCandidate[],
        candidatesTotal: a.candidatesTotal,
      })),
    ];

    for (let i = 0; i < items.length; i += INSERT_CHUNK) {
      await this.itemsRepo.insert(items.slice(i, i + INSERT_CHUNK));
    }

    this.logger.log(
      `[email-reconcile] session created jobId=${jobId} accountId=${job.accountId} auto=${computation.matches.length} ambiguous=${computation.ambiguous.length} no_match=${computation.noMatches.length}`,
    );
    return this.getProgress(jobId);
  }

  async getProgress(jobId: string): Promise<ReconcileSessionProgress> {
    const session = await this.sessionsRepo.findOne({ where: { jobId } });
    if (!session) throw new NotFoundException(`No reconcile session for job ${jobId}`);

    const counts: Array<{ kind: string; status: string; count: string }> = await this.itemsRepo
      .createQueryBuilder('i')
      .select('i.kind', 'kind')
      .addSelect('i.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('i.job_id = :jobId', { jobId })
      .groupBy('i.kind')
      .addGroupBy('i.status')
      .getRawMany();

    const get = (kind: string, status: string): number => Number(counts.find((c) => c.kind === kind && c.status === status)?.count ?? 0);
    const auto = {
      applied: get('auto', 'applied'),
      failed: get('auto', 'failed'),
      pending: get('auto', 'pending'),
      total: 0,
    };
    auto.total = auto.applied + auto.failed + auto.pending;
    const ambiguous = {
      applied: get('ambiguous', 'applied'),
      skipped: get('ambiguous', 'skipped'),
      pending: get('ambiguous', 'pending'),
      failed: get('ambiguous', 'failed'),
      total: 0,
    };
    ambiguous.total = ambiguous.applied + ambiguous.skipped + ambiguous.pending + ambiguous.failed;

    return {
      jobId,
      csvRows: session.csvRows,
      invalidCsvRows: session.invalidCsvRows,
      contactsMasked: session.contactsMasked,
      alreadyClean: session.alreadyClean,
      noMatches: session.noMatchTotal,
      noMatchSample: session.noMatchSample,
      auto: { total: auto.total, applied: auto.applied, failed: auto.failed, pending: auto.pending },
      ambiguous: {
        total: ambiguous.total,
        applied: ambiguous.applied,
        skipped: ambiguous.skipped,
        pending: ambiguous.pending,
        failed: ambiguous.failed,
      },
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  async getAmbiguousPage(jobId: string, offset: number, limit: number, q?: string): Promise<AmbiguousPageResult> {
    await this.requireSession(jobId);
    const qb = this.itemsRepo
      .createQueryBuilder('i')
      .where('i.job_id = :jobId', { jobId })
      .andWhere("i.kind = 'ambiguous'")
      .andWhere("i.status = 'pending'")
      .orderBy('i.id', 'ASC')
      .skip(offset)
      .take(limit);
    this.applySearch(qb, q);
    const [rows, totalPending] = await qb.getManyAndCount();

    const usedBy = await this.findUsedCandidates(jobId, rows);

    return {
      totalPending,
      offset,
      items: rows.map((r) => ({
        contactId: r.contactId,
        currentEmail: r.currentEmail,
        contactName: r.contactName ?? '',
        candidates: (r.candidates ?? []).map((c) => {
          const usedByContactId = usedBy.get(c.csvEmail.toLowerCase());
          return usedByContactId !== undefined && usedByContactId !== r.contactId ? { ...c, usedByContactId } : c;
        }),
        candidatesTotal: r.candidatesTotal ?? r.candidates?.length ?? 0,
      })),
    };
  }

  /**
   * Emails from this page's candidates that were already applied in this
   * session, mapped to the contact that received them. Keyed by email (not
   * CSV row number) so duplicate CSV rows carrying the same address are
   * flagged too. Lets the UI disable picks that would collide with the
   * per-account email uniqueness instead of failing after the fact.
   */
  private async findUsedCandidates(jobId: string, rows: EmailReconcileItemEntity[]): Promise<Map<string, number>> {
    const emails = new Set<string>();
    for (const r of rows) for (const c of r.candidates ?? []) emails.add(c.csvEmail.toLowerCase());
    if (emails.size === 0) return new Map();

    const applied: Array<{ new_email: string; contact_id: number }> = await this.itemsRepo
      .createQueryBuilder('i')
      .select('i.new_email', 'new_email')
      .addSelect('i.contact_id', 'contact_id')
      .where('i.job_id = :jobId', { jobId })
      .andWhere("i.status = 'applied'")
      .andWhere('LOWER(i.new_email) IN (:...emails)', { emails: [...emails] })
      .getRawMany();

    return new Map(applied.map((a) => [a.new_email.toLowerCase(), Number(a.contact_id)]));
  }

  /**
   * Flat, searchable listing of session items — the operator's "who matched
   * what" view. Covers every kind/status (auto picks, applied, failed,
   * skipped, pending ambiguous); the resolution UI stays in the ambiguous
   * queue, this is for visibility and lookup.
   */
  async getItemsPage(
    jobId: string,
    opts: { kind?: 'auto' | 'ambiguous'; status?: 'pending' | 'applied' | 'skipped' | 'failed'; q?: string; offset: number; limit: number },
  ): Promise<ReconcileItemsPage> {
    await this.requireSession(jobId);
    const qb = this.itemsRepo.createQueryBuilder('i').where('i.job_id = :jobId', { jobId }).orderBy('i.id', 'ASC').skip(opts.offset).take(opts.limit);
    if (opts.kind) qb.andWhere('i.kind = :kind', { kind: opts.kind });
    if (opts.status) qb.andWhere('i.status = :status', { status: opts.status });
    this.applySearch(qb, opts.q);
    const [rows, total] = await qb.getManyAndCount();

    return {
      total,
      offset: opts.offset,
      items: rows.map((r) => ({
        contactId: r.contactId,
        contactName: r.contactName ?? '',
        currentEmail: r.currentEmail,
        kind: r.kind,
        status: r.status,
        newEmail: r.newEmail ?? null,
        csvRowNumber: r.csvRowNumber ?? null,
        failureReason: r.failureReason ?? null,
        candidatesTotal: r.candidatesTotal ?? null,
      })),
    };
  }

  /**
   * Case-insensitive contains-search over everything the operator can see:
   * contact name, masked email, applied email, and (for ambiguous items) the
   * candidates payload — so searching a raw CSV email finds the queue entry
   * offering it.
   */
  private applySearch(qb: { andWhere: (clause: string, params: Record<string, string>) => unknown }, q?: string): void {
    const term = (q ?? '').trim();
    if (!term) return;
    const escaped = term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
    qb.andWhere('(i.contact_name ILIKE :q OR i.current_email ILIKE :q OR i.new_email ILIKE :q OR i.candidates::text ILIKE :q)', { q: `%${escaped}%` });
  }

  /**
   * Applies a page of operator decisions immediately. Bounded by the DTO, so
   * each call stays interactive; the contact write goes through repo.update
   * per row on purpose — the @BeforeUpdate listener re-derives hashed_email.
   */
  async resolveBatch(jobId: string, resolutions: ApplyResolution[]): Promise<ResolveBatchResult> {
    const session = await this.requireSession(jobId);
    const items = await this.itemsRepo.find({
      where: { jobId, contactId: In(resolutions.map((r) => r.contactId)), kind: 'ambiguous', status: 'pending' },
    });
    const byContact = new Map(items.map((i) => [i.contactId, i]));

    let applied = 0;
    let skipped = 0;
    let invalid = 0;
    const failures: Array<{ contactId: number; reason: string }> = [];

    for (const resolution of resolutions) {
      const item = byContact.get(resolution.contactId);
      if (!item) {
        invalid++;
        continue;
      }

      if (resolution.csvRowNumber === null) {
        await this.itemsRepo.update({ id: item.id }, { status: 'skipped' });
        skipped++;
        continue;
      }

      const candidate = (item.candidates ?? []).find((c) => c.csvRowNumber === resolution.csvRowNumber);
      if (!candidate) {
        invalid++;
        continue;
      }

      const outcome = await this.applyEmail(item, candidate.csvEmail, candidate.csvRowNumber, session.accountId);
      if (outcome) failures.push(outcome);
      else applied++;
    }

    return { applied, skipped, invalid, failures, progress: await this.getProgress(jobId) };
  }

  /** Applies the next `limit` pending auto items. The client loops until remaining=0. */
  async applyAutoChunk(jobId: string, limit: number): Promise<ApplyAutoChunkResult> {
    const session = await this.requireSession(jobId);
    const chunk = await this.itemsRepo.find({
      where: { jobId, kind: 'auto', status: 'pending' },
      order: { id: 'ASC' },
      take: limit,
    });

    let applied = 0;
    let failed = 0;
    for (const item of chunk) {
      const outcome = await this.applyEmail(item, item.newEmail!, item.csvRowNumber, session.accountId);
      if (outcome) failed++;
      else applied++;
    }

    const remaining = await this.itemsRepo.count({ where: { jobId, kind: 'auto', status: 'pending' } });
    this.logger.log(`[email-reconcile] auto chunk jobId=${jobId} applied=${applied} failed=${failed} remaining=${remaining}`);
    return { applied, failed, remaining };
  }

  /**
   * Clears pending ambiguous items in bulk.
   *  - best-name: applies candidates[0] (best score) when it clears the
   *    operator-chosen threshold AND strictly beats the runner-up. Items that
   *    don't qualify stay pending — the id cursor (afterId) keeps the client
   *    loop moving instead of re-examining them forever.
   *  - skip-remaining: marks every pending ambiguous item skipped (single SQL).
   */
  async bulkResolve(jobId: string, strategy: 'best-name' | 'skip-remaining', threshold: number, limit: number, afterId?: string): Promise<BulkResolveResult> {
    const session = await this.requireSession(jobId);

    if (strategy === 'skip-remaining') {
      const result = await this.itemsRepo.update({ jobId, kind: 'ambiguous', status: 'pending' }, { status: 'skipped' });
      return { resolved: result.affected ?? 0, unresolved: 0, nextAfterId: null, remainingPending: 0 };
    }

    const qb = this.itemsRepo
      .createQueryBuilder('i')
      .where('i.job_id = :jobId', { jobId })
      .andWhere("i.kind = 'ambiguous'")
      .andWhere("i.status = 'pending'")
      .orderBy('i.id', 'ASC')
      .take(limit);
    if (afterId) qb.andWhere('i.id > :afterId', { afterId });
    const chunk = await qb.getMany();

    // Emails among the chunk's best candidates that some contact already owns
    // (an applied auto pick, an earlier resolution, or a clean contact). The
    // AUTOMATIC strategy must never consume those — the item stays pending in
    // the similarity queue, where only an explicit operator decision settles
    // it. Applying here would just burn the item as failed.
    const taken = await this.findTakenEmails(
      session.accountId,
      chunk.map((i) => i.candidates?.[0]?.csvEmail).filter((e): e is string => Boolean(e)),
    );

    let resolved = 0;
    let unresolved = 0;
    for (const item of chunk) {
      const best = item.candidates?.[0];
      const runner = item.candidates?.[1];
      const wins = best && best.score >= threshold && (!runner || runner.score < best.score);
      if (!wins || taken.has(best.csvEmail.toLowerCase())) {
        unresolved++;
        continue;
      }
      const outcome = await this.applyEmail(item, best.csvEmail, best.csvRowNumber, session.accountId);
      if (outcome) unresolved++;
      else {
        resolved++;
        // Two chunk items may share the same best email — the win consumes it.
        taken.add(best.csvEmail.toLowerCase());
      }
    }

    const remainingPending = await this.itemsRepo.count({ where: { jobId, kind: 'ambiguous', status: 'pending' } });
    const nextAfterId = chunk.length < limit ? null : chunk[chunk.length - 1].id;
    this.logger.log(`[email-reconcile] bulk best-name jobId=${jobId} threshold=${threshold} resolved=${resolved} unresolved=${unresolved} remaining=${remainingPending}`);
    return { resolved, unresolved, nextAfterId, remainingPending };
  }

  async deleteSession(jobId: string): Promise<void> {
    await this.requireSession(jobId);
    await this.sessionsRepo.delete({ jobId });
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  /**
   * Writes the contact + item status. Returns a failure record or null on
   * success. save() over an entity instance (NOT repo.update, which skips
   * entity listeners) so @BeforeUpdate re-derives hashed_email/email_provider
   * from the new raw email — the SHA-256 contact lookup depends on it.
   */
  private async applyEmail(
    item: EmailReconcileItemEntity,
    newEmail: string,
    csvRowNumber: number | null,
    accountId: number,
  ): Promise<{ contactId: number; reason: string } | null> {
    try {
      // Friendly pre-check before the unique index does it the hard way: the
      // email may already belong to another contact in the account (a clean
      // one, or one reconciled earlier in this session). The index still
      // backs this up if a concurrent write slips through.
      const holder = await this.contactsRepo.findOne({ where: { accountId, email: newEmail.toLowerCase() } });
      if (holder && holder.id !== item.contactId) {
        const reason = `email already in use by contact #${holder.id}`;
        await this.itemsRepo.update({ id: item.id }, { status: 'failed', failureReason: reason });
        return { contactId: item.contactId, reason };
      }

      await this.contactsRepo.save(this.contactsRepo.create({ id: item.contactId, email: newEmail }));
      await this.itemsRepo.update({ id: item.id }, { status: 'applied', newEmail, csvRowNumber });
      return null;
    } catch (err: any) {
      const reason = err?.message ?? String(err);
      await this.itemsRepo.update({ id: item.id }, { status: 'failed', failureReason: reason });
      return { contactId: item.contactId, reason };
    }
  }

  /** Which of these emails already belong to some contact in the account (lowercased set). */
  private async findTakenEmails(accountId: number, emails: string[]): Promise<Set<string>> {
    const unique = [...new Set(emails.map((e) => e.toLowerCase()))];
    if (unique.length === 0) return new Set();
    const holders = await this.contactsRepo.find({
      where: { accountId, email: In(unique) },
      select: ['email'],
    });
    return new Set(holders.map((h) => h.email.toLowerCase()));
  }

  private async requireSession(jobId: string): Promise<EmailReconcileSessionEntity> {
    const session = await this.sessionsRepo.findOne({ where: { jobId } });
    if (!session) throw new NotFoundException(`No reconcile session for job ${jobId}`);
    return session;
  }

  private async requireJob(jobId: string): Promise<EnterpriseImportJobEntity> {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Import job ${jobId} not found`);
    if (!job.accountId) {
      throw new BadRequestException(`Import job ${jobId} has no accountId — cannot reconcile`);
    }
    return job;
  }
}
