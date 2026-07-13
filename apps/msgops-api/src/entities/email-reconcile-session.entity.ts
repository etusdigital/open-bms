import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// One reconcile working set per import job. The CSV is parsed and matched
// ONCE (POST /imports/:jobId/reconcile/session); the outcome is persisted here
// plus one row per masked contact in email_reconcile_items, so the operator
// can resolve/apply in paginated batches without re-uploading the CSV.
// Re-creating the session replaces the previous one (job_id is the PK).
@Entity('email_reconcile_sessions')
export class EmailReconcileSessionEntity {
  @PrimaryColumn('uuid', { name: 'job_id' })
  jobId: string;

  @Column('integer', { name: 'account_id' })
  accountId: number;

  @Column('integer', { name: 'csv_rows' })
  csvRows: number;

  @Column('integer', { name: 'invalid_csv_rows' })
  invalidCsvRows: number;

  @Column('integer', { name: 'contacts_masked' })
  contactsMasked: number;

  @Column('integer', { name: 'already_clean' })
  alreadyClean: number;

  @Column('integer', { name: 'no_match_total' })
  noMatchTotal: number;

  // Small capped sample for display only — the full no-match set is derivable
  // from contacts that stay masked after the session is exhausted.
  @Column('jsonb', { name: 'no_match_sample', default: () => "'[]'" })
  noMatchSample: Array<{ contactId: number; currentEmail: string }>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
