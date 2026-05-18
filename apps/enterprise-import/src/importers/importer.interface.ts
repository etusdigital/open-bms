import { DataSource } from 'typeorm';
import { EnterpriseSession } from '../enterprise-client/enterprise.client';
import { IdMapperService } from '../id-mapper.service';
import { EnterpriseImportScope } from '../entities/enterprise-import-job.entity';

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
  // scope=instance: set per iteration (one account at a time).
  // scope=account: fixed (the new OSS account id).
  accountId: number | null;
  scope: EnterpriseImportScope;
  client: EnterpriseSession;
  idMapper: IdMapperService;
  dataSource: DataSource;
  // Current checkpoint (read from DB at start). Importer skips if entity != self.
  checkpoint: { entity?: string; page?: number; accountId?: number };
  updateProgress: UpdateProgressFn;
  setCheckpoint: SetCheckpointFn;
}

export interface ImporterStep {
  // Short checkpoint name (e.g. 'tags'); must be unique in the pipeline.
  readonly name: string;
  run(ctx: ImportContext): Promise<void>;
}
