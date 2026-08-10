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
  // Source rows read. The only denominator when the source reports no real
  // total (/contacts returns the page size).
  seen?: number;
  // Absent when nothing was discarded.
  discarded?: Record<DiscardReason, number>;
}

// `mapper_rejected` and `fk_unresolved` are kept apart on purpose: the first is
// a data decision the importer made, the second means a parent step did not
// import what this row points at. Same lost row, opposite fix.
export type DiscardReason = 'mapper_rejected' | 'fk_unresolved' | 'empty_natural_key' | 'duplicate_in_page' | 'insert_conflict';

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
