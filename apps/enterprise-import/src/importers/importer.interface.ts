import { DataSource } from 'typeorm';
import { EnterpriseSession } from '../enterprise-client/enterprise.client';
import { IdMapperService } from '../id-mapper.service';
import { EnterpriseImportScope } from '../../../msgops-api/src/entities/enterprise-import-job.entity';

export interface ImportProgressEntry {
  total?: number;
  done?: number;
  page?: number;
  skipped?: boolean;
  reason?: string;
}

export type UpdateProgressFn = (entity: string, patch: ImportProgressEntry) => Promise<void>;
export type SetCheckpointFn = (entity: string, page: number, accountId?: number) => Promise<void>;

export interface ImportContext {
  jobId: string;
  // Pra scope=instance, o currentAccountId é setado por iteração (1 conta por vez).
  // Pra scope=account, é fixo no jobId (id NOVO no OSS).
  accountId: number | null;
  // ID da conta NO ENTERPRISE (origem). Em scope=account é o id que o operador
  // informou; em scope=instance é o próprio id preservado. Usado por endpoints
  // do Enterprise que exigem accountId explícito (ex.: statistics export).
  enterpriseSourceAccountId: number | null;
  scope: EnterpriseImportScope;
  client: EnterpriseSession;
  idMapper: IdMapperService;
  dataSource: DataSource;
  // Checkpoint atual (lido do DB no início). Importer pode pular se entity != self.
  checkpoint: { entity?: string; page?: number; accountId?: number };
  updateProgress: UpdateProgressFn;
  setCheckpoint: SetCheckpointFn;
}

export interface ImporterStep {
  // Nome curto pra checkpoint (ex.: 'tags', 'contacts'). Tem que ser único na pipeline.
  readonly name: string;
  run(ctx: ImportContext): Promise<void>;
}
