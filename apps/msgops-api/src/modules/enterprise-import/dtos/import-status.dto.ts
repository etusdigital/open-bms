import { EnterpriseImportScope, EnterpriseImportStatus } from '../../../entities/enterprise-import-job.entity';

// Shape devolvido nos endpoints públicos. NUNCA inclui `encryptedApiKey`
// nem qualquer outro segredo. Construído manualmente em mapToStatusDto()
// no service pra garantir whitelist de campos.
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
  error: string | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}
