import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parseString } from 'fast-csv';
import { ContactEntity } from '../../entities/contact.entity';
import { EnterpriseImportJobEntity } from '../../entities/enterprise-import-job.entity';
import { maskEmail } from '../../utils/masking/email-masker';
import { inferCsvOffsetMinutes, parseCsvTimestamp, timeMatchLevel } from './reconcile-timestamp.util';
import type { AmbiguousMatch, ApplyResolution, ApplyResult, CsvRow, ReconcileComputation, ReconcileMatch, ReconcilePreview, TimeMatchLevel } from './email-reconcile.types';

const AMBIGUOUS_SAMPLE_LIMIT = 100;
const NO_MATCH_SAMPLE_LIMIT = 50;
const NAME_TIE_BREAK_THRESHOLD = 0.8; // Jaccard token similarity above this counts as a confident match.
// Columns the matching pipeline depends on: email is the mask key, created_at
// and the name signal disambiguate collisions. A CSV missing any of them is
// rejected before processing — a half-matched run over a wrong export is
// worse than a hard error. The frontend blocks the same set pre-upload.
// The name signal accepts either a single `name` column or the
// first_name/last_name pair (exports vary between the two shapes).
export const ALWAYS_REQUIRED_CSV_COLUMNS = ['email', 'created_at'] as const;
export const NAME_SIGNAL_COLUMNS = ['name', 'first_name', 'last_name'] as const;
const MISSING_NAME_SIGNAL_TOKEN = 'name (or first_name + last_name)';
// Machine-readable marker on the 400 response so the UI can render a
// column-specific message instead of the raw server string.
export const MISSING_COLUMNS_ERROR_CODE = 'RECONCILE_MISSING_COLUMNS';
// Masks keep only 5 chars of the local part, so short/common prefixes over a
// large base collide by the thousands. Everything that leaves this service
// (preview response, session storage) carries at most this many candidates
// per ambiguous contact, sorted by name-similarity score.
export const AMBIGUOUS_CANDIDATES_LIMIT = 20;

// An auto decision plus how strongly it agrees with the contact — kept so
// competing claims over the same CSV row can be arbitrated (dedupeAutoPicks).
type AutoPick = { contact: ContactEntity; row: CsvRow; timeMatch: TimeMatchLevel; score: number };

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
 *      One row → uniqueMatch. Two or more → disambiguate by created_at
 *      agreement, then name similarity (see `matchContact`). Otherwise the
 *      operator decides via the resolutions payload on `apply`.
 *
 * The CSV must carry email, created_at and a name signal (`name` or the
 * first_name/last_name pair); anything missing is a hard 400 before any row
 * is processed.
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
    const computation = await this.computeReconciliation(csv, job.accountId);

    return {
      csvRows: computation.csvRows,
      invalidCsvRows: computation.invalidCsvRows,
      contactsMasked: computation.contactsMasked,
      uniqueMatches: computation.matches.length,
      ambiguousMatches: computation.ambiguous.length,
      noMatches: computation.noMatches.length,
      alreadyClean: computation.alreadyClean,
      ambiguousSample: computation.ambiguous.slice(0, AMBIGUOUS_SAMPLE_LIMIT).map((a) => ({
        ...a,
        candidates: a.candidates.slice(0, AMBIGUOUS_CANDIDATES_LIMIT),
      })),
      noMatchSample: computation.noMatches.slice(0, NO_MATCH_SAMPLE_LIMIT),
    };
  }

  /**
   * Parses the CSV and matches it against the account's masked contacts.
   * Pure read — persisting/applying is up to the caller (preview serves a
   * capped view; the session flow stores it for batched resolution).
   *
   * The CSV must always be processed WHOLE: matching buckets rows by mask, so
   * a partial read would misreport collisions from other parts of the file as
   * unique matches.
   */
  async computeReconciliation(csv: string, accountId: number, ignoreColumns: string[] = []): Promise<ReconcileComputation> {
    const rows = await this.parseCsv(csv, ignoreColumns);
    const validRows = rows.filter((r) => r.email && r.email.includes('@'));
    const invalidCsvRows = rows.length - validRows.length;

    const bucketsByMask = this.bucketByMask(validRows);
    const maskedContacts = await this.loadMaskedContacts(accountId);
    const maskCollisions = this.countContactsByMask(maskedContacts);
    const alreadyClean = await this.countCleanContacts(accountId);
    const csvOffset = this.inferCsvOffset(maskedContacts, bucketsByMask, maskCollisions);

    const matches: ReconcileMatch[] = [];
    const ambiguous: AmbiguousMatch[] = [];
    const noMatches: Array<{ contactId: number; currentEmail: string }> = [];
    const autoPicks: AutoPick[] = [];

    for (const contact of maskedContacts) {
      const candidates = bucketsByMask.get(contact.email) ?? [];
      if (candidates.length === 0) {
        noMatches.push({ contactId: contact.id, currentEmail: contact.email });
        continue;
      }

      const outcome = this.matchContact(contact, candidates, maskCollisions.get(contact.email) ?? 1, csvOffset);
      if (outcome.kind === 'auto') {
        autoPicks.push({ contact, row: outcome.row, timeMatch: outcome.timeMatch, score: outcome.score });
        continue;
      }

      ambiguous.push({
        contactId: contact.id,
        currentEmail: contact.email,
        contactName: outcome.contactName,
        candidates: outcome.scored.map((s) => ({
          csvRowNumber: s.row.rowNumber,
          csvName: s.row.name,
          csvEmail: s.row.email,
          score: Math.round(s.score * 1000) / 1000,
          timeMatch: s.timeMatch,
        })),
        candidatesTotal: outcome.scored.length,
      });
    }

    const { winners, demoted } = this.dedupeAutoPicks(autoPicks);
    for (const w of winners) {
      matches.push({
        contactId: w.contact.id,
        currentEmail: w.contact.email,
        newEmail: w.row.email,
        csvRowNumber: w.row.rowNumber,
        contactName: `${w.contact.firstName ?? ''} ${w.contact.lastName ?? ''}`.trim(),
      });
    }
    for (const d of demoted) {
      ambiguous.push({
        contactId: d.contact.id,
        currentEmail: d.contact.email,
        contactName: `${d.contact.firstName ?? ''} ${d.contact.lastName ?? ''}`.trim(),
        candidates: [
          {
            csvRowNumber: d.row.rowNumber,
            csvName: d.row.name,
            csvEmail: d.row.email,
            score: Math.round(d.score * 1000) / 1000,
            timeMatch: d.timeMatch,
          },
        ],
        candidatesTotal: 1,
      });
    }

    return {
      csvRows: rows.length,
      invalidCsvRows,
      contactsMasked: maskedContacts.length,
      alreadyClean,
      matches,
      ambiguous,
      noMatches,
    };
  }

  async apply(jobId: string, csv: string, resolutions: ApplyResolution[] = []): Promise<ApplyResult> {
    const job = await this.requireJob(jobId);
    const rows = await this.parseCsv(csv);
    const validRows = rows.filter((r) => r.email && r.email.includes('@'));
    const rowsByNumber = new Map<number, CsvRow>(validRows.map((r) => [r.rowNumber, r]));

    const bucketsByMask = this.bucketByMask(validRows);
    const maskedContacts = await this.loadMaskedContacts(job.accountId);
    const maskCollisions = this.countContactsByMask(maskedContacts);
    const csvOffset = this.inferCsvOffset(maskedContacts, bucketsByMask, maskCollisions);
    const resolutionsById = new Map(resolutions.map((r) => [r.contactId, r.csvRowNumber]));

    const updates: ReconcileMatch[] = [];
    const autoPicks: AutoPick[] = [];
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
      const outcome = this.matchContact(contact, candidates, maskCollisions.get(contact.email) ?? 1, csvOffset);
      if (outcome.kind === 'auto') {
        autoPicks.push({ contact, row: outcome.row, timeMatch: outcome.timeMatch, score: outcome.score });
        continue;
      }
      // Ambiguous and the operator didn't decide → leave alone.
      skippedAmbiguous++;
    }

    // Same arbitration as the preview: one CSV row reconciles one contact.
    const { winners, demoted } = this.dedupeAutoPicks(autoPicks);
    for (const w of winners) {
      updates.push({
        contactId: w.contact.id,
        currentEmail: w.contact.email,
        newEmail: w.row.email,
        csvRowNumber: w.row.rowNumber,
      });
    }
    skippedAmbiguous += demoted.length;

    const failures: ApplyResult['failures'] = [];
    let updated = 0;

    // Updates run per-row through save() over an entity instance so the
    // @BeforeUpdate listener (setUserDetails) fires — that re-derives
    // hashed_email and email_provider from the new raw email. repo.update()
    // and bulk UPDATEs skip entity listeners and would leave both stale,
    // breaking the SHA-256 contact lookup downstream.
    for (const u of updates) {
      try {
        // Friendly pre-check before the unique index does it the hard way:
        // the email may already belong to another contact in the account
        // (a clean contact, or one reconciled earlier in this same batch).
        const holder = await this.contactsRepo.findOne({ where: { accountId: job.accountId!, email: u.newEmail.toLowerCase() } });
        if (holder && holder.id !== u.contactId) {
          failures.push({ contactId: u.contactId, reason: `email already in use by contact #${holder.id}` });
          continue;
        }
        await this.contactsRepo.save(this.contactsRepo.create({ id: u.contactId, email: u.newEmail }));
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

  private parseCsv(csv: string, ignoreColumns: string[] = []): Promise<CsvRow[]> {
    const notIgnorable = new Set<string>([...ALWAYS_REQUIRED_CSV_COLUMNS, ...NAME_SIGNAL_COLUMNS]);
    const ignored = new Set(ignoreColumns.map((c) => c.trim().toLowerCase()).filter((c) => !notIgnorable.has(c)));
    return new Promise((resolve, reject) => {
      const rows: CsvRow[] = [];
      let lineNumber = 0;
      // Exports vary between comma and semicolon; sniff the header line.
      const headerLine = csv.slice(0, csv.indexOf('\n') === -1 ? csv.length : csv.indexOf('\n'));
      const delimiter = headerLine.split(';').length > headerLine.split(',').length ? ';' : ',';
      const stream = parseString(csv, {
        delimiter,
        trim: true,
        // Normalize headers so `Email`/`EMAIL ` still map to `email`.
        headers: (headers) => headers.map((h) => (h ?? '').trim().toLowerCase()),
      })
        .on('error', reject)
        .on('headers', (headers: string[]) => {
          const present = new Set(headers);
          const missing: string[] = [];
          if (!present.has('name') && !(present.has('first_name') && present.has('last_name'))) {
            missing.push(MISSING_NAME_SIGNAL_TOKEN);
          }
          missing.push(...ALWAYS_REQUIRED_CSV_COLUMNS.filter((c) => !present.has(c)));
          if (missing.length > 0) {
            reject(
              new BadRequestException({
                statusCode: 400,
                error: 'Bad Request',
                code: MISSING_COLUMNS_ERROR_CODE,
                missing,
                message: `CSV is missing required column(s): ${missing.join(', ')}`,
              }),
            );
            stream.destroy(); // don't parse 350k rows after rejecting
          }
        })
        .on('data', (row: Record<string, string>) => {
          lineNumber++;
          const createdAtRaw = row.created_at ?? '';
          // Exports carry either a joined `name` or the first/last pair —
          // compose per-row so a blank `name` still falls back to the pair.
          const name = (row.name ?? '').trim() || [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
          rows.push({
            name,
            email: (row.email ?? '').toLowerCase(),
            status: ignored.has('status') ? '' : (row.status ?? ''),
            created_at: createdAtRaw,
            createdAtTs: parseCsvTimestamp(createdAtRaw),
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

  /** How many masked contacts share each mask — the contact-side collision count. */
  private countContactsByMask(contacts: ContactEntity[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const c of contacts) map.set(c.email, (map.get(c.email) ?? 0) + 1);
    return map;
  }

  /**
   * Decides one masked contact against its mask-collision bucket.
   *
   * Layered: created_at agreement first, name similarity second.
   *   1) A single CSV row in the bucket → auto ONLY when the contact is also
   *      the only one with that mask. With N contacts sharing the mask, a
   *      partial CSV (or filtered export) would otherwise assign the same row
   *      to all N — the lone row must earn the pick via time/name like any
   *      other candidate.
   *   2) Rank candidates by created_at agreement (exact instant > same day >
   *      none) and keep only the best tier. The import preserves the source
   *      created_at, so the true row agrees with the contact by construction —
   *      a lone candidate in a non-zero tier is a confident pick.
   *   3) Within the surviving tier, name similarity decides as before
   *      (Jaccard ≥ 0.8 with no runner-up at the threshold).
   * Anything left goes to the operator, carrying only the surviving tier —
   * time-disagreeing candidates are noise, not options.
   */
  private matchContact(
    contact: ContactEntity,
    candidates: CsvRow[],
    maskCollisions: number,
    csvOffsetMinutes: number | null,
  ):
    | { kind: 'auto'; row: CsvRow; timeMatch: TimeMatchLevel; score: number }
    | { kind: 'ambiguous'; contactName: string; scored: Array<{ row: CsvRow; score: number; timeMatch: TimeMatchLevel }> } {
    const contactName = `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim();
    const target = tokenize(contactName);
    const scoreOf = (row: CsvRow) => (target.size === 0 ? 0 : jaccard(target, tokenize(row.name)));
    // Auto picks always carry their agreement strength so the caller can
    // arbitrate when two contacts claim the same CSV row (dedupeAutoPicks).
    const auto = (row: CsvRow, timeMatch: TimeMatchLevel) => ({ kind: 'auto' as const, row, timeMatch, score: scoreOf(row) });

    if (candidates.length === 1 && maskCollisions <= 1) {
      const row = candidates[0];
      return auto(row, timeMatchLevel(contact.createdAt, row.createdAtTs, csvOffsetMinutes));
    }

    const leveled = candidates.map((row) => ({ row, timeMatch: timeMatchLevel(contact.createdAt, row.createdAtTs, csvOffsetMinutes) }));
    const bestLevel = Math.max(...leveled.map((l) => l.timeMatch));
    const pool = bestLevel > 0 ? leveled.filter((l) => l.timeMatch === bestLevel) : leveled;
    if (bestLevel > 0 && pool.length === 1) return auto(pool[0].row, pool[0].timeMatch);

    const scored = pool.map((l) => ({ row: l.row, score: scoreOf(l.row), timeMatch: l.timeMatch })).sort((a, b) => b.score - a.score);

    const best = scored[0];
    const runner = scored[1];
    if (best.score >= NAME_TIE_BREAK_THRESHOLD && (!runner || runner.score < NAME_TIE_BREAK_THRESHOLD)) {
      return { kind: 'auto', row: best.row, timeMatch: best.timeMatch, score: best.score };
    }
    return { kind: 'ambiguous', contactName, scored };
  }

  /**
   * The CSV's timezone offset, inferred once per run (see
   * inferCsvOffsetMinutes). Samples come only from masks that collide with
   * exactly one CSV row AND one contact: there the pairing is certain, so the
   * delta between the two timestamps IS the export's offset. Colliding masks
   * are deliberately left out — feeding guesses into the inference would
   * defeat its purpose. Returns null when the CSV carries explicit offsets or
   * the sample is too thin to commit, and matching then stops at day level.
   */
  private inferCsvOffset(contacts: ContactEntity[], bucketsByMask: Map<string, CsvRow[]>, maskCollisions: Map<string, number>): number | null {
    const samples: Array<{ contactMs: number; ts: CsvRow['createdAtTs'] }> = [];
    for (const contact of contacts) {
      if ((maskCollisions.get(contact.email) ?? 1) > 1) continue;
      const bucket = bucketsByMask.get(contact.email);
      if (!bucket || bucket.length !== 1) continue;
      if (!contact.createdAt) continue;
      samples.push({ contactMs: contact.createdAt.getTime(), ts: bucket[0].createdAtTs });
    }
    return inferCsvOffsetMinutes(samples);
  }

  /**
   * Email is unique per account (contact_email_unique index), so one address
   * can reconcile at most ONE contact. When several contacts independently
   * auto-pick the same address, only the strongest agreement (time tier, then
   * name score) keeps the auto — the rest are demoted to the ambiguous queue
   * for the operator, instead of failing later on the unique index.
   *
   * Arbitration is by NORMALIZED EMAIL, not by CSV row: exports repeat the same
   * address across rows, and keying by row let each duplicate produce its own
   * automatic winner — the second one then died on the unique index at apply
   * time. The email is what the database enforces, so it is what we arbitrate.
   */
  private dedupeAutoPicks(picks: AutoPick[]): { winners: AutoPick[]; demoted: AutoPick[] } {
    const byEmail = new Map<string, AutoPick[]>();
    for (const p of picks) {
      const key = p.row.email.toLowerCase();
      const group = byEmail.get(key);
      if (group) group.push(p);
      else byEmail.set(key, [p]);
    }

    const winners: AutoPick[] = [];
    const demoted: AutoPick[] = [];
    for (const group of byEmail.values()) {
      if (group.length > 1) group.sort((a, b) => b.timeMatch - a.timeMatch || b.score - a.score);
      winners.push(group[0]);
      demoted.push(...group.slice(1));
    }
    return { winners, demoted };
  }
}

function tokenize(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip diacritics
      .replace(/[^\p{L}\p{N}]+/gu, ' ') // punctuation → separator ("Silva, Lucas" tokenizes like "Silva Lucas")
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
