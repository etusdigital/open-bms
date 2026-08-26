import { EnterpriseImportScope, EnterpriseImportStatus } from '../../../entities/enterprise-import-job.entity';

// Shape returned by the public endpoints. NEVER includes `encryptedApiKey` or
// any other secret. Built manually in the service's mapToStatusDto() to enforce
// a field whitelist.
// Mirrors the worker's ImportProgressEntry (apps/enterprise-import). `progress`
// is passed through verbatim from the jsonb, so this type is what documents the
// endpoint's payload — keep both sides in sync.
export interface ImportProgressEntry {
  total?: number;
  done?: number;
  page?: number;
  skipped?: boolean;
  reason?: string;
  seen?: number;
  discarded?: Record<string, number>;
}

export interface ImportStatusDto {
  jobId: string;
  accountId: number | null;
  scope: EnterpriseImportScope;
  status: EnterpriseImportStatus;
  enterpriseBaseUrl: string;
  progress: Record<string, ImportProgressEntry>;
  checkpoint: { entity?: string; page?: number; accountId?: number };
  selectedSteps: string[] | null;
  error: string | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}
