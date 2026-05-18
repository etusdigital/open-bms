import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type EnterpriseImportScope = 'account' | 'instance';
export type EnterpriseImportStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

@Entity('enterprise_import_jobs')
@Index('enterprise_import_jobs_status_idx', ['status'])
export class EnterpriseImportJobEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column('integer', { name: 'account_id', nullable: true })
  accountId: number | null;

  @Column('integer', { name: 'enterprise_source_account_id', nullable: true })
  enterpriseSourceAccountId: number | null;

  @Column('varchar', { name: 'scope', length: 16 })
  scope: EnterpriseImportScope;

  @Column('varchar', { name: 'enterprise_base_url', length: 512 })
  enterpriseBaseUrl: string;

  @Column('text', { name: 'encrypted_api_key', nullable: true })
  encryptedApiKey: string | null;

  @Column('varchar', { name: 'status', length: 32, default: 'pending' })
  status: EnterpriseImportStatus;

  @Column('jsonb', { name: 'progress', default: () => `'{}'` })
  progress: Record<string, { total?: number; done?: number; page?: number; skipped?: boolean; reason?: string }>;

  @Column('jsonb', { name: 'checkpoint', default: () => `'{}'` })
  checkpoint: { entity?: string; page?: number; accountId?: number };

  @Column('text', { name: 'error', nullable: true })
  error: string | null;

  @Column('integer', { name: 'created_by', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column('timestamptz', { name: 'started_at', nullable: true })
  startedAt: Date | null;

  @Column('timestamptz', { name: 'finished_at', nullable: true })
  finishedAt: Date | null;
}
