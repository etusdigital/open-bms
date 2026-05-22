import { EnterpriseImportScope, EnterpriseImportStatus } from '../../../entities/enterprise-import-job.entity';

// Shape returned by the public endpoints. NEVER includes `encryptedApiKey` or
// any other secret. Built manually in the service's mapToStatusDto() to enforce
// a field whitelist.
export interface ImportProgressEntry {
  total?: number;
  done?: number;
  page?: number;
  skipped?: boolean;
  reason?: string;
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
