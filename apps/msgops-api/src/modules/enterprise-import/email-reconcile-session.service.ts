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
  ReopenConflictsResult,
  ResolveBatchResult,
} from './email-reconcile.types';

const NO_MATCH_SAMPLE_LIMIT = 50;
const INSERT_CHUNK = 1000;
// Ceiling for `email IN (...)` lookups — see findEmailHolders.
const EMAIL_LOOKUP_CHUNK = 1000;

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
    const accountId = job.accountId!;
    const computation = await this.reconcileService.computeReconciliation(csv, accountId, ignoreColumns);

    // Addresses already owned by a contact in the account. An auto pick over
    // one of those cannot be applied (per-account email uniqueness), so it is
    // born as a conflict instead of burning an apply attempt to discover it.
    const holders = await this.findEmailHolders(
      accountId,
      computation.matches.map((m) => m.newEmail),
    );

    const items: Array<Partial<EmailReconcileItemEntity>> = [
      ...computation.matches.map((m) => {
        const holderId = holders.get(m.newEmail.toLowerCase());
        const conflicting = holderId !== undefined && holderId !== m.contactId;
        return {
          jobId,
          contactId: m.contactId,
          currentEmail: m.currentEmail,
          contactName: m.contactName || null,
          kind: 'auto' as const,
          status: conflicting ? ('conflict' as const) : ('pending' as const),
          failureReason: conflicting ? `email already in use by contact #${holderId}` : null,
          newEmail: m.newEmail,
          csvRowNumber: m.csvRowNumber,
          // A conflicting auto item enters the SAME review queue as ambiguous
          // items (getAmbiguousPage/resolveBatch), so it needs a candidates
          // array to resolve against. It only ever had the one pick — this
          // preserves it instead of leaving the item reviewable but empty.
          candidates: conflicting ? [{ csvRowNumber: m.csvRowNumber, csvName: m.contactName || '', csvEmail: m.newEmail, score: 1 }] : null,
          candidatesTotal: conflicting ? 1 : null,
        };
      }),
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

    // Replace the previous working set atomically: an interrupted rewrite used
    // to leave a session header with partial (or zero) items, which reads as a
    // perfectly valid — and silently truncated — reconciliation.
    await this.sessionsRepo.manager.transaction(async (em) => {
      await em.delete(EmailReconcileSessionEntity, { jobId });
      await em.insert(EmailReconcileSessionEntity, {
        jobId,
        accountId,
        csvRows: computation.csvRows,
        invalidCsvRows: computation.invalidCsvRows,
        contactsMasked: computation.contactsMasked,
        alreadyClean: computation.alreadyClean,
        noMatchTotal: computation.noMatches.length,
        noMatchSample: computation.noMatches.slice(0, NO_MATCH_SAMPLE_LIMIT),
      });
      for (let i = 0; i < items.length; i += INSERT_CHUNK) {
        await em.insert(EmailReconcileItemEntity, items.slice(i, i + INSERT_CHUNK));
      }
    });

    this.logger.log(
      `[email-reconcile] session created jobId=${jobId} accountId=${accountId} auto=${computation.matches.length} ambiguous=${computation.ambiguous.length} no_match=${computation.noMatches.length}`,
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
      conflict: get('auto', 'conflict'),
      pending: get('auto', 'pending'),
      total: 0,
    };
    auto.total = auto.applied + auto.failed + auto.conflict + auto.pending;
    const ambiguous = {
      applied: get('ambiguous', 'applied'),
      skipped: get('ambiguous', 'skipped'),
      pending: get('ambiguous', 'pending'),
      failed: get('ambiguous', 'failed'),
      conflict: get('ambiguous', 'conflict'),
      total: 0,
    };
    ambiguous.total = ambiguous.applied + ambiguous.skipped + ambiguous.pending + ambiguous.failed + ambiguous.conflict;

    return {
      jobId,
      csvRows: session.csvRows,
      invalidCsvRows: session.invalidCsvRows,
      contactsMasked: session.contactsMasked,
      alreadyClean: session.alreadyClean,
      noMatches: session.noMatchTotal,
      noMatchSample: session.noMatchSample,
      auto: { total: auto.total, applied: auto.applied, failed: auto.failed, conflict: auto.conflict, pending: auto.pending },
      ambiguous: {
        total: ambiguous.total,
        applied: ambiguous.applied,
        skipped: ambiguous.skipped,
        pending: ambiguous.pending,
        failed: ambiguous.failed,
        conflict: ambiguous.conflict,
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
      // Conflicting items belong in the review queue regardless of kind: the
      // address they wanted is taken, so a human has to pick another candidate
      // or skip the contact. A conflicting auto item is the same situation as
      // an ambiguous one, just with a single candidate (see createSession) —
      // without this an auto conflict is unreachable outside reopenConflicts,
      // which just retries the same losing email forever.
      .andWhere(this.reviewQueueClause())
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
    opts: { kind?: 'auto' | 'ambiguous'; status?: 'pending' | 'applied' | 'skipped' | 'failed' | 'conflict'; q?: string; offset: number; limit: number },
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
   * SQL for "items a human still needs to decide": every pending/conflict
   * ambiguous item, plus conflicting auto items (which carry a single
   * candidate — see createSession). Kept in one place so the review queue,
   * resolveBatch, and the skip-remaining bulk action agree on membership.
   */
  private reviewQueueClause(): string {
    return "((i.kind = 'ambiguous' AND i.status IN ('pending', 'conflict')) OR (i.kind = 'auto' AND i.status = 'conflict'))";
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
    // `conflict` items are resolvable too: the operator can pick another
    // candidate or skip the contact. Only decided items (applied/skipped) and
    // hard failures are out of reach here. Matches the same membership as
    // getAmbiguousPage — a conflicting auto item is resolvable the same way,
    // against the single candidate createSession gave it.
    const contactIds = resolutions.map((r) => r.contactId);
    const items = await this.itemsRepo.find({
      where: [
        { jobId, contactId: In(contactIds), kind: 'ambiguous', status: In(['pending', 'conflict']) },
        { jobId, contactId: In(contactIds), kind: 'auto', status: 'conflict' },
      ],
    });
    const byContact = new Map(items.map((i) => [i.contactId, i]));

    // Batch the holder lookup instead of one findOne() per resolution — see
    // applyEmail's doc. Every candidate email of every touched item, not just
    // the one resolution.csvRowNumber points at: cheap (bounded by the DTO)
    // and covers whichever candidate the operator actually picked. Falls back
    // to newEmail for auto-conflict items persisted before candidates were
    // populated on them (older, in-flight sessions).
    const wantedEmails = items.flatMap((item) => item.candidates?.map((c) => c.csvEmail) ?? (item.newEmail ? [item.newEmail] : []));
    const holders = await this.findEmailHolders(session.accountId, wantedEmails);

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

      const outcome = await this.applyEmail(item, candidate.csvEmail, candidate.csvRowNumber, holders);
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

    // ContactEntity has four eager relations, so applyEmail's old per-item
    // findOne() turned a 5k-10k chunk into that many relation-heavy reads —
    // the bottleneck on the 350k-contact case. One batched, relation-free
    // lookup replaces all of them; applyEmail keeps it current in place as it
    // writes (see its doc).
    const holders = await this.findEmailHolders(
      session.accountId,
      chunk.map((i) => i.newEmail!),
    );

    let applied = 0;
    let failed = 0;
    let conflicts = 0;
    for (const item of chunk) {
      const outcome = await this.applyEmail(item, item.newEmail!, item.csvRowNumber, holders);
      if (!outcome) applied++;
      else if (outcome.conflict) conflicts++;
      else failed++;
    }

    const remaining = await this.itemsRepo.count({ where: { jobId, kind: 'auto', status: 'pending' } });
    this.logger.log(`[email-reconcile] auto chunk jobId=${jobId} applied=${applied} failed=${failed} conflicts=${conflicts} remaining=${remaining}`);
    return { applied, failed, conflicts, remaining };
  }

  /**
   * Puts conflicting items back in the queue.
   *
   * A conflict means the address was taken when we tried it — usually by a
   * duplicate contact the operator then removes, or by a pick they later
   * changed. Reopening returns them to `pending`, where the normal passes
   * (apply-auto for auto items, the review queue for ambiguous ones) pick them
   * up again. Items that still conflict simply land back here, so this
   * converges instead of looping.
   */
  async reopenConflicts(jobId: string): Promise<ReopenConflictsResult> {
    await this.requireSession(jobId);
    const result = await this.itemsRepo.update({ jobId, status: 'conflict' }, { status: 'pending', failureReason: null });
    const reopened = result.affected ?? 0;
    this.logger.log(`[email-reconcile] conflicts reopened jobId=${jobId} reopened=${reopened}`);
    return { reopened, progress: await this.getProgress(jobId) };
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
      // Clears the whole review queue, conflicts included (both ambiguous and
      // conflicting auto items — see reviewQueueClause) — they are exactly the
      // items the operator is declining to decide. repo.update() takes one
      // criteria object, so this is two statements instead of the single OR
      // getAmbiguousPage/resolveBatch use.
      const ambiguous = await this.itemsRepo.update({ jobId, kind: 'ambiguous', status: In(['pending', 'conflict']) }, { status: 'skipped' });
      const autoConflict = await this.itemsRepo.update({ jobId, kind: 'auto', status: 'conflict' }, { status: 'skipped' });
      return { resolved: (ambiguous.affected ?? 0) + (autoConflict.affected ?? 0), unresolved: 0, nextAfterId: null, remainingPending: 0 };
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

    // Emails among the chunk's best candidates that some OTHER contact already
    // owns (an applied auto pick, an earlier resolution, or a clean contact).
    // The AUTOMATIC strategy must never consume those — the item stays pending
    // in the similarity queue, where only an explicit operator decision settles
    // it. Applying here would just park the item as a conflict. Also the
    // batched holder lookup applyEmail expects — see its doc — instead of a
    // findOne() per item.
    const holders = await this.findEmailHolders(
      session.accountId,
      chunk.map((i) => i.candidates?.[0]?.csvEmail).filter((e): e is string => Boolean(e)),
    );

    let resolved = 0;
    let unresolved = 0;
    for (const item of chunk) {
      const best = item.candidates?.[0];
      const runner = item.candidates?.[1];
      const wins = best && best.score >= threshold && (!runner || runner.score < best.score);
      const holderId = best ? holders.get(best.csvEmail.toLowerCase()) : undefined;
      if (!wins || (holderId !== undefined && holderId !== item.contactId)) {
        unresolved++;
        continue;
      }
      // applyEmail updates `holders` in place on success, so a later item in
      // this same chunk that shares the same best email sees it as taken via
      // the check above — no separate bookkeeping needed here.
      const outcome = await this.applyEmail(item, best.csvEmail, best.csvRowNumber, holders);
      if (outcome) unresolved++;
      else resolved++;
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
   *
   * `holders` is a batch-level map (newEmail.toLowerCase() -> contactId) built
   * ONCE by the caller via findEmailHolders, not a per-item query — see
   * applyAutoChunk. Mutated in place on a successful write so a later item in
   * the SAME batch that wants the address just taken sees it too, matching
   * what a per-item findOne would have seen.
   */
  private async applyEmail(
    item: EmailReconcileItemEntity,
    newEmail: string,
    csvRowNumber: number | null,
    holders: Map<string, number>,
  ): Promise<{ contactId: number; reason: string; conflict?: true } | null> {
    const key = newEmail.toLowerCase();
    try {
      // Friendly pre-check before the unique index does it the hard way: the
      // email may already belong to another contact in the account (a clean
      // one, or one reconciled earlier in this session). The index still
      // backs this up if a concurrent write slips through.
      //
      // This is a CONFLICT, not a failure: nothing is broken, two rows want the
      // same address and only the operator can say which one is right. The item
      // leaves the automatic queue (retrying is pointless) but stays resolvable
      // — manually via resolve, or in bulk via reopenConflicts.
      const holderId = holders.get(key);
      if (holderId !== undefined && holderId !== item.contactId) {
        const reason = `email already in use by contact #${holderId}`;
        await this.itemsRepo.update({ id: item.id }, { status: 'conflict', failureReason: reason, newEmail, csvRowNumber });
        return { contactId: item.contactId, reason, conflict: true };
      }

      await this.contactsRepo.save(this.contactsRepo.create({ id: item.contactId, email: newEmail }));
      holders.set(key, item.contactId);
      await this.itemsRepo.update({ id: item.id }, { status: 'applied', newEmail, csvRowNumber });
      return null;
    } catch (err: any) {
      const reason = err?.message ?? String(err);
      await this.itemsRepo.update({ id: item.id }, { status: 'failed', failureReason: reason });
      return { contactId: item.contactId, reason };
    }
  }

  /**
   * Which of these addresses already belong to a contact in the account, mapped
   * to the owner's id. Queried in chunks: callers hand over whole apply batches
   * (up to 20k) or a full session's auto picks (350k on real imports), and a
   * single IN list that size is a query planner problem, not a lookup.
   */
  private async findEmailHolders(accountId: number, emails: string[]): Promise<Map<string, number>> {
    const unique = [...new Set(emails.map((e) => e.toLowerCase()))];
    const found = new Map<string, number>();
    for (let i = 0; i < unique.length; i += EMAIL_LOOKUP_CHUNK) {
      const holders = await this.contactsRepo.find({
        where: { accountId, email: In(unique.slice(i, i + EMAIL_LOOKUP_CHUNK)) },
        select: ['id', 'email'],
        // ContactEntity has four eager OneToMany relations (tags, custom
        // fields, automations, devices). find() joins and hydrates them
        // regardless of `select` unless told not to — for a lookup that only
        // needs id+email, that is dead weight on every single call.
        loadEagerRelations: false,
      });
      for (const h of holders) found.set(h.email.toLowerCase(), h.id);
    }
    return found;
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
