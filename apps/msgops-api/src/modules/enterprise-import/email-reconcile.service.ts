import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parseString } from 'fast-csv';
import { ContactEntity } from '../../entities/contact.entity';
import { EnterpriseImportJobEntity } from '../../entities/enterprise-import-job.entity';
import { maskEmail } from '../../utils/masking/email-masker';
import type { AmbiguousMatch, ApplyResolution, ApplyResult, CsvRow, ReconcileMatch, ReconcilePreview } from './email-reconcile.types';

const AMBIGUOUS_SAMPLE_LIMIT = 100;
const NO_MATCH_SAMPLE_LIMIT = 50;
const NAME_TIE_BREAK_THRESHOLD = 0.8; // Jaccard token similarity above this counts as a confident match.

/**
 * Workaround service for EVO-1464.
 *
 * Enterprise's `GET /contacts` returns emails masked (`lucas***@gmail.com`),
 * which the import worker grafts straight into the OSS DB. The masked address
 * is unusable for sending — every campaign bounces. The BMS Enterprise UI
 * does expose a CSV export with raw emails, so the operator can drop that CSV
 * here and we patch the contacts in place by reconstructing the mask of each
 * CSV row and matching it against the masked rows in the DB.
 *
 * Matching is two-pass:
 *   1) Bucket CSV rows by their reconstructed mask (deterministic — same
 *      algorithm as `maskEmail`).
 *   2) For each masked contact, look up its bucket. Zero rows → noMatch.
 *      One row → uniqueMatch. Two or more → try name similarity; if a single
 *      CSV row clears the threshold, treat it as confident. Otherwise the
 *      operator decides via the resolutions payload on `apply`.
 *
 * `apply` only writes contacts the operator has either uniquely matched or
 * explicitly resolved. Anything missing from the payload is left alone.
 */
@Injectable()
export class EmailReconcileService {
  private readonly logger = new Logger(EmailReconcileService.name);

  constructor(
    @InjectRepository(ContactEntity)
    private readonly contactsRepo: Repository<ContactEntity>,
    @InjectRepository(EnterpriseImportJobEntity)
    private readonly jobsRepo: Repository<EnterpriseImportJobEntity>,
  ) {}

  async preview(jobId: string, csv: string): Promise<ReconcilePreview> {
    const job = await this.requireJob(jobId);
    const rows = await this.parseCsv(csv);
    const validRows = rows.filter((r) => r.email && r.email.includes('@'));
    const invalidCsvRows = rows.length - validRows.length;

    const bucketsByMask = this.bucketByMask(validRows);
    const maskedContacts = await this.loadMaskedContacts(job.accountId);
    const alreadyClean = await this.countCleanContacts(job.accountId);

    const matches: ReconcileMatch[] = [];
    const ambiguous: AmbiguousMatch[] = [];
    const noMatches: Array<{ contactId: number; currentEmail: string }> = [];

    for (const contact of maskedContacts) {
      const candidates = bucketsByMask.get(contact.email) ?? [];
      if (candidates.length === 0) {
        noMatches.push({ contactId: contact.id, currentEmail: contact.email });
        continue;
      }

      if (candidates.length === 1) {
        matches.push({
          contactId: contact.id,
          currentEmail: contact.email,
          newEmail: candidates[0].email,
          csvRowNumber: candidates[0].rowNumber,
        });
        continue;
      }

      // Multiple CSV rows share this mask. Try name similarity to recover a
      // single confident pick before falling back to operator resolution.
      const contactName = `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim();
      const confident = this.pickByName(contactName, candidates);
      if (confident) {
        matches.push({
          contactId: contact.id,
          currentEmail: contact.email,
          newEmail: confident.email,
          csvRowNumber: confident.rowNumber,
        });
        continue;
      }

      ambiguous.push({
        contactId: contact.id,
        currentEmail: contact.email,
        contactName,
        candidates: candidates.map((c) => ({
          csvRowNumber: c.rowNumber,
          csvName: c.name,
          csvEmail: c.email,
        })),
      });
    }

    return {
      csvRows: rows.length,
      invalidCsvRows,
      contactsMasked: maskedContacts.length,
      uniqueMatches: matches.length,
      ambiguousMatches: ambiguous.length,
      noMatches: noMatches.length,
      alreadyClean,
      ambiguousSample: ambiguous.slice(0, AMBIGUOUS_SAMPLE_LIMIT),
      noMatchSample: noMatches.slice(0, NO_MATCH_SAMPLE_LIMIT),
    };
  }

  async apply(jobId: string, csv: string, resolutions: ApplyResolution[] = []): Promise<ApplyResult> {
    const job = await this.requireJob(jobId);
    const rows = await this.parseCsv(csv);
    const validRows = rows.filter((r) => r.email && r.email.includes('@'));
    const rowsByNumber = new Map<number, CsvRow>(validRows.map((r) => [r.rowNumber, r]));

    const bucketsByMask = this.bucketByMask(validRows);
    const maskedContacts = await this.loadMaskedContacts(job.accountId);
    const resolutionsById = new Map(resolutions.map((r) => [r.contactId, r.csvRowNumber]));

    const updates: ReconcileMatch[] = [];
    let skippedAmbiguous = 0;
    let skippedNoMatch = 0;

    for (const contact of maskedContacts) {
      const candidates = bucketsByMask.get(contact.email) ?? [];
      const resolved = resolutionsById.get(contact.id);

      // Explicit "skip" from the operator wins over any auto-pick.
      if (resolved === null) {
        skippedAmbiguous++;
        continue;
      }

      // Operator-picked CSV row (overrides auto-pick).
      if (typeof resolved === 'number') {
        const row = rowsByNumber.get(resolved);
        if (!row) {
          skippedAmbiguous++;
          continue;
        }
        updates.push({
          contactId: contact.id,
          currentEmail: contact.email,
          newEmail: row.email,
          csvRowNumber: row.rowNumber,
        });
        continue;
      }

      // No explicit resolution — apply the same auto-pick logic as preview()
      // so the operator's "apply" matches what they previewed.
      if (candidates.length === 0) {
        skippedNoMatch++;
        continue;
      }
      if (candidates.length === 1) {
        updates.push({
          contactId: contact.id,
          currentEmail: contact.email,
          newEmail: candidates[0].email,
          csvRowNumber: candidates[0].rowNumber,
        });
        continue;
      }
      const contactName = `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim();
      const confident = this.pickByName(contactName, candidates);
      if (confident) {
        updates.push({
          contactId: contact.id,
          currentEmail: contact.email,
          newEmail: confident.email,
          csvRowNumber: confident.rowNumber,
        });
        continue;
      }
      // Ambiguous and the operator didn't decide → leave alone.
      skippedAmbiguous++;
    }

    const failures: ApplyResult['failures'] = [];
    let updated = 0;

    // Updates run per-row through the repository so the @BeforeUpdate
    // listener (setUserDetails) fires — that re-derives hashed_email and
    // email_provider from the new raw email. A bulk UPDATE would leave both
    // stale and break the SHA-256 contact lookup downstream.
    for (const u of updates) {
      try {
        await this.contactsRepo.update({ id: u.contactId }, { email: u.newEmail });
        updated++;
      } catch (err: any) {
        failures.push({ contactId: u.contactId, reason: err?.message ?? String(err) });
      }
    }

    this.logger.log(
      `[email-reconcile] jobId=${jobId} accountId=${job.accountId} updated=${updated} skipped_ambiguous=${skippedAmbiguous} skipped_no_match=${skippedNoMatch} failures=${failures.length}`,
    );

    return { updated, skippedAmbiguous, skippedNoMatch, failures };
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  private async requireJob(jobId: string): Promise<EnterpriseImportJobEntity> {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Import job ${jobId} not found`);
    if (!job.accountId) {
      throw new BadRequestException(`Import job ${jobId} has no accountId — cannot reconcile`);
    }
    return job;
  }

  private parseCsv(csv: string): Promise<CsvRow[]> {
    return new Promise((resolve, reject) => {
      const rows: CsvRow[] = [];
      let lineNumber = 0;
      parseString(csv, { headers: true, trim: true })
        .on('error', reject)
        .on('data', (row: Record<string, string>) => {
          lineNumber++;
          rows.push({
            name: row.name ?? '',
            email: (row.email ?? '').toLowerCase(),
            status: row.status ?? '',
            created_at: row.created_at ?? '',
            rowNumber: lineNumber,
          });
        })
        .on('end', () => resolve(rows));
    });
  }

  private bucketByMask(rows: CsvRow[]): Map<string, CsvRow[]> {
    const map = new Map<string, CsvRow[]>();
    for (const row of rows) {
      const mask = maskEmail(row.email);
      if (!mask) continue;
      const bucket = map.get(mask);
      if (bucket) bucket.push(row);
      else map.set(mask, [row]);
    }
    return map;
  }

  private async loadMaskedContacts(accountId: number): Promise<ContactEntity[]> {
    // `***` is a stable mask signature — the email_masker always emits exactly
    // three asterisks (`email-masker.ts:29`). Anything matching is by
    // definition not a real email and is safe to reconcile.
    return this.contactsRepo.createQueryBuilder('c').where('c.account_id = :accountId', { accountId }).andWhere("c.email LIKE '%***%'").getMany();
  }

  private async countCleanContacts(accountId: number): Promise<number> {
    return this.contactsRepo.createQueryBuilder('c').where('c.account_id = :accountId', { accountId }).andWhere("c.email NOT LIKE '%***%'").getCount();
  }

  /**
   * When two or more CSV rows map to the same mask, compare each candidate's
   * `name` to the contact's full name. Return a single confident pick or
   * null. Threshold: Jaccard ≥ 0.8 over lowercased name tokens.
   */
  private pickByName(contactName: string, candidates: CsvRow[]): CsvRow | null {
    const target = tokenize(contactName);
    if (target.size === 0) return null;

    const scored = candidates.map((c) => ({ row: c, score: jaccard(target, tokenize(c.name)) })).sort((a, b) => b.score - a.score);

    const best = scored[0];
    const runner = scored[1];

    if (best.score >= NAME_TIE_BREAK_THRESHOLD && (!runner || runner.score < NAME_TIE_BREAK_THRESHOLD)) {
      return best.row;
    }
    return null;
  }
}

function tokenize(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip diacritics
      .split(/\s+/)
      .filter((t) => t.length > 1), // ignore single-letter middle initials
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return intersection / union;
}
