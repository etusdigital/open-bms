import { apiClient } from '@/lib/api-client';

// EVO-1464 workaround — types must match
// apps/msgops-api/src/modules/enterprise-import/email-reconcile.types.ts

export interface AmbiguousCandidate {
  csvRowNumber: number;
  csvName: string;
  csvEmail: string;
}

export interface AmbiguousMatch {
  contactId: number;
  currentEmail: string;
  contactName: string;
  candidates: AmbiguousCandidate[];
}

export interface ReconcilePreview {
  csvRows: number;
  invalidCsvRows: number;
  contactsMasked: number;
  uniqueMatches: number;
  ambiguousMatches: number;
  noMatches: number;
  alreadyClean: number;
  ambiguousSample: AmbiguousMatch[];
  noMatchSample: Array<{ contactId: number; currentEmail: string }>;
}

export interface ApplyResolution {
  contactId: number;
  // null means "skip this contact / leave masked".
  csvRowNumber: number | null;
}

export interface ApplyResult {
  updated: number;
  skippedAmbiguous: number;
  skippedNoMatch: number;
  failures: Array<{ contactId: number; reason: string }>;
}

export const reconcileGateway = {
  async preview(jobId: string, csv: string): Promise<ReconcilePreview> {
    const { data } = await apiClient.post<ReconcilePreview>(`/imports/${jobId}/reconcile/preview`, { csv });
    return data;
  },

  async apply(jobId: string, csv: string, resolutions: ApplyResolution[]): Promise<ApplyResult> {
    const { data } = await apiClient.post<ApplyResult>(`/imports/${jobId}/reconcile/apply`, { csv, resolutions });
    return data;
  },
};
