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
  // Original 1-based row number in the CSV — surfaces in reports so the
  // operator can find the row in the source file.
  rowNumber: number;
}

export interface ReconcileMatch {
  contactId: number;
  currentEmail: string; // masked email already in DB (e.g., lucas***@gmail.com)
  newEmail: string; // raw email from CSV
  csvRowNumber: number;
}

export interface AmbiguousCandidate {
  csvRowNumber: number;
  csvName: string;
  csvEmail: string;
}

export interface AmbiguousMatch {
  contactId: number;
  currentEmail: string;
  contactName: string;
  // CSV rows whose mask collides with this contact. Two or more is the
  // ambiguous case — UI prompts the operator to pick one or skip.
  candidates: AmbiguousCandidate[];
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
