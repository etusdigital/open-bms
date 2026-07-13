// Workaround for EVO-1464: Enterprise's GET /contacts returns email masked
// (e.g., `lucas***@gmail.com`), and the import worker can't recover the raw
// address. This module reconciles a CSV exported from BMS — which DOES carry
// raw emails — against the masked rows we already imported, swapping the
// masked email for the real one on a match.

export interface CsvRow {
  name: string;
  email: string;
  status: string;
  created_at: string;
  // Parsed form of created_at — null when the raw value is empty/unparseable.
  createdAtTs: ParsedCsvTimestamp | null;
  // Original 1-based row number in the CSV — surfaces in reports so the
  // operator can find the row in the source file.
  rowNumber: number;
}

// created_at as written in the CSV. Exports may carry no timezone offset, so
// the epoch is computed as-if-UTC and `hasOffset` tells consumers whether it
// is trustworthy as an absolute instant.
export interface ParsedCsvTimestamp {
  epochMs: number;
  hasTime: boolean;
  hasOffset: boolean;
  // Date part exactly as written (YYYY-MM-DD) — the export's local calendar date.
  dateISO: string;
}

// How strongly a candidate's created_at agrees with the contact's:
//   2 = same minute (seconds/milliseconds ignored on both sides — exports
//       truncate them — tolerating a fixed timezone offset)
//   1 = same calendar date
//   0 = no agreement / not comparable
export type TimeMatchLevel = 0 | 1 | 2;

export interface ReconcileMatch {
  contactId: number;
  currentEmail: string; // masked email already in DB (e.g., lucas***@gmail.com)
  newEmail: string; // raw email from CSV
  csvRowNumber: number;
  // Contact's full name — persisted on session items so the operator can
  // search matches by name, not just by email.
  contactName?: string;
}

export interface AmbiguousCandidate {
  csvRowNumber: number;
  csvName: string;
  csvEmail: string;
  // Jaccard token similarity between contact name and csvName (0..1).
  // Candidates ship sorted by it, best first.
  score: number;
  // created_at agreement with the contact (see TimeMatchLevel). Typed as
  // number because it round-trips through jsonb storage; optional because
  // sessions persisted before the field existed have candidates without it.
  timeMatch?: number;
  // Set when this candidate's row/email was already applied to another
  // contact in this session. Computed at read time (getAmbiguousPage), never
  // stored — picking it again would violate the per-account email uniqueness.
  usedByContactId?: number;
}

export interface AmbiguousMatch {
  contactId: number;
  currentEmail: string;
  contactName: string;
  // CSV rows whose mask collides with this contact, sorted by score desc and
  // CAPPED — short masks over big bases collide by the thousands, and an
  // uncapped list once produced multi-hundred-MB responses. Two or more is
  // the ambiguous case — UI prompts the operator to pick one or skip.
  candidates: AmbiguousCandidate[];
  // Real candidate count before the cap ("showing 20 of N").
  candidatesTotal: number;
}

export interface ReconcilePreview {
  csvRows: number; // total CSV rows (excludes header)
  invalidCsvRows: number; // rows skipped (missing email/name, bad format)
  contactsMasked: number; // contacts in DB with `***` for this account
  uniqueMatches: number;
  ambiguousMatches: number;
  noMatches: number; // masked contacts with no CSV row mapping to them
  alreadyClean: number; // contacts NOT in the masked set — left alone
  // Capped samples for the UI. Full lists travel only on `apply` via the
  // resolutions payload (so the response stays under the body limit on
  // large imports).
  ambiguousSample: AmbiguousMatch[];
  noMatchSample: Array<{ contactId: number; currentEmail: string }>;
}

export interface ApplyResolution {
  // Operator's pick for an ambiguous case. `csvRowNumber === null` means
  // "skip this contact — leave masked".
  contactId: number;
  csvRowNumber: number | null;
}

export interface ApplyResult {
  updated: number; // unique matches + resolutions applied
  skippedAmbiguous: number;
  skippedNoMatch: number;
  failures: Array<{ contactId: number; reason: string }>;
}

// ─── Persisted session flow (batched reconciliation) ────────────────────────

// Full in-memory outcome of parsing + matching one CSV against one account.
// preview() serves a capped view of it; the session flow persists it.
export interface ReconcileComputation {
  csvRows: number;
  invalidCsvRows: number;
  contactsMasked: number;
  alreadyClean: number;
  matches: ReconcileMatch[];
  // Candidates inside each entry are already scored/sorted but NOT capped —
  // consumers cap for transport/storage.
  ambiguous: AmbiguousMatch[];
  noMatches: Array<{ contactId: number; currentEmail: string }>;
}

export interface ReconcileSessionProgress {
  jobId: string;
  csvRows: number;
  invalidCsvRows: number;
  contactsMasked: number;
  alreadyClean: number;
  noMatches: number;
  noMatchSample: Array<{ contactId: number; currentEmail: string }>;
  // Quantified progress the UI renders as bars/counters.
  auto: { total: number; applied: number; failed: number; pending: number };
  ambiguous: { total: number; applied: number; skipped: number; pending: number; failed: number };
  createdAt: string;
  updatedAt: string;
}

export interface AmbiguousPageResult {
  totalPending: number;
  offset: number;
  items: AmbiguousMatch[];
}

// One row of the session items table — the operator-facing "who matched what"
// listing (auto picks, applied/failed/skipped outcomes, ambiguous queue).
export interface ReconcileItemRow {
  contactId: number;
  contactName: string;
  currentEmail: string;
  kind: 'auto' | 'ambiguous';
  status: 'pending' | 'applied' | 'skipped' | 'failed';
  newEmail: string | null;
  csvRowNumber: number | null;
  failureReason: string | null;
  candidatesTotal: number | null;
}

export interface ReconcileItemsPage {
  total: number;
  offset: number;
  items: ReconcileItemRow[];
}

export interface ResolveBatchResult {
  applied: number;
  skipped: number;
  // Resolutions that referenced an unknown/already-decided item or a CSV row
  // not among the stored candidates.
  invalid: number;
  failures: Array<{ contactId: number; reason: string }>;
  progress: ReconcileSessionProgress;
}

export interface ApplyAutoChunkResult {
  applied: number;
  failed: number;
  remaining: number;
}

export interface BulkResolveResult {
  // Items decided+applied by the strategy in this call.
  resolved: number;
  // Items examined but left pending (no candidate cleared the threshold).
  unresolved: number;
  // Cursor for the next call — null when the pending set is exhausted.
  nextAfterId: string | null;
  remainingPending: number;
}
