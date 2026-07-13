import { apiClient } from '@/lib/api-client';

// Types must match
// apps/msgops-api/src/modules/enterprise-import/email-reconcile.types.ts

export interface AmbiguousCandidate {
  csvRowNumber: number;
  csvName: string;
  csvEmail: string;
  // Name-similarity score (0..1) — candidates arrive sorted by it, best first.
  score: number;
  // created_at agreement with the contact: 2 = exact instant, 1 = same date,
  // 0 = none. Absent on sessions created before the field existed.
  timeMatch?: number;
  // Present when this candidate's email was already applied to another
  // contact in this session — picking it would collide with the per-account
  // email uniqueness, so the UI disables it.
  usedByContactId?: number;
}

export interface AmbiguousMatch {
  contactId: number;
  currentEmail: string;
  contactName: string;
  // Top candidates only ("showing candidates.length of candidatesTotal").
  candidates: AmbiguousCandidate[];
  candidatesTotal: number;
}

export interface ReconcileSessionProgress {
  jobId: string;
  csvRows: number;
  invalidCsvRows: number;
  contactsMasked: number;
  alreadyClean: number;
  noMatches: number;
  noMatchSample: Array<{ contactId: number; currentEmail: string }>;
  auto: { total: number; applied: number; failed: number; pending: number };
  ambiguous: { total: number; applied: number; skipped: number; pending: number; failed: number };
  createdAt: string;
  updatedAt: string;
}

export interface AmbiguousPage {
  totalPending: number;
  offset: number;
  items: AmbiguousMatch[];
}

// One row of the session items table — "who matched what".
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

export interface ReconcileItemsQuery {
  offset: number;
  limit: number;
  q?: string;
  kind?: 'auto' | 'ambiguous';
  status?: 'pending' | 'applied' | 'skipped' | 'failed';
}

export interface ApplyResolution {
  contactId: number;
  // null means "skip this contact / leave masked".
  csvRowNumber: number | null;
}

export interface ResolveBatchResult {
  applied: number;
  skipped: number;
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
  resolved: number;
  unresolved: number;
  nextAfterId: string | null;
  remainingPending: number;
}

// Batched reconciliation over a server-side session: the CSV uploads ONCE
// (createSession) and every later step is an incremental, quantified batch.
export const reconcileGateway = {
  async getSession(jobId: string): Promise<ReconcileSessionProgress | null> {
    try {
      const { data } = await apiClient.get<ReconcileSessionProgress>(`/imports/${jobId}/reconcile/session`);
      return data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },

  async createSession(jobId: string, csv: string, ignoreColumns: string[] = []): Promise<ReconcileSessionProgress> {
    // Parsing + matching + persisting 350k contacts takes a while — disable
    // the client timeout and let the server/nginx budget govern.
    const { data } = await apiClient.post<ReconcileSessionProgress>(`/imports/${jobId}/reconcile/session`, { csv, ignoreColumns }, { timeout: 0 });
    return data;
  },

  async ambiguousPage(jobId: string, offset: number, limit: number, q?: string): Promise<AmbiguousPage> {
    const { data } = await apiClient.get<AmbiguousPage>(`/imports/${jobId}/reconcile/session/ambiguous`, {
      params: { offset, limit, ...(q ? { q } : {}) },
    });
    return data;
  },

  async itemsPage(jobId: string, query: ReconcileItemsQuery): Promise<ReconcileItemsPage> {
    const { data } = await apiClient.get<ReconcileItemsPage>(`/imports/${jobId}/reconcile/session/items`, {
      params: query,
    });
    return data;
  },

  async resolve(jobId: string, resolutions: ApplyResolution[]): Promise<ResolveBatchResult> {
    const { data } = await apiClient.post<ResolveBatchResult>(`/imports/${jobId}/reconcile/session/resolve`, { resolutions });
    return data;
  },

  async applyAuto(jobId: string, limit: number): Promise<ApplyAutoChunkResult> {
    const { data } = await apiClient.post<ApplyAutoChunkResult>(`/imports/${jobId}/reconcile/session/apply-auto`, { limit }, { timeout: 0 });
    return data;
  },

  async bulkResolve(
    jobId: string,
    payload: { strategy: 'best-name'; threshold: number; limit: number; afterId?: string } | { strategy: 'skip-remaining' },
  ): Promise<BulkResolveResult> {
    const { data } = await apiClient.post<BulkResolveResult>(`/imports/${jobId}/reconcile/session/bulk-resolve`, payload, { timeout: 0 });
    return data;
  },

  async deleteSession(jobId: string): Promise<void> {
    await apiClient.delete(`/imports/${jobId}/reconcile/session`);
  },
};
