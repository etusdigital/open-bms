import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type EnterpriseImportScope = 'account' | 'instance';
export type EnterpriseImportStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

// Estado de uma execução de import Enterprise → OSS. PK uuid pra
// não colidir com sequences operacionais e ser identificável publicamente.
// `account_id` é nullable porque scope=instance importa todas as contas.
// `progress` e `checkpoint` em jsonb permitem retomada exata: a UI lê
// progress; o processor lê checkpoint pra pular entidades já feitas.
// Constraint partial-unique em status ativo é criada na migration.
@Entity('enterprise_import_jobs')
@Index('enterprise_import_jobs_status_idx', ['status'])
export class EnterpriseImportJobEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column('integer', { name: 'account_id', nullable: true })
  accountId: number | null;

  // ID da conta NO ENTERPRISE (origem) p/ scope=account. Necessário pra
  // endpoints do Enterprise que exigem accountId explícito (statistics export).
  // Nullable: se ausente, o importer de statistics pula com motivo claro (F5).
  @Column('integer', { name: 'enterprise_source_account_id', nullable: true })
  enterpriseSourceAccountId: number | null;

  @Column('varchar', { name: 'scope', length: 16 })
  scope: EnterpriseImportScope;

  @Column('varchar', { name: 'enterprise_base_url', length: 512 })
  enterpriseBaseUrl: string;

  // Cifrado com AES-256-GCM (api-key-encryption.util.ts). Nullable porque é
  // limpo (set null) ao terminar pra reduzir superfície.
  @Column('text', { name: 'encrypted_api_key', nullable: true })
  encryptedApiKey: string | null;

  @Column('varchar', { name: 'status', length: 32, default: 'pending' })
  status: EnterpriseImportStatus;

  @Column('jsonb', { name: 'progress', default: () => `'{}'` })
  progress: Record<string, { total?: number; done?: number; page?: number; skipped?: boolean; reason?: string }>;

  @Column('jsonb', { name: 'checkpoint', default: () => `'{}'` })
  checkpoint: { entity?: string; page?: number; accountId?: number };

  // Subconjunto de passos do pipeline a rodar (re-import seletivo). null/vazio =
  // pipeline completo. O worker expande pra incluir os pais obrigatórios.
  @Column('jsonb', { name: 'selected_steps', nullable: true })
  selectedSteps: string[] | null;

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
