import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Persisted reconcile working set (email reconciliation of masked imports).
 *
 * The previous flow was stateless: the whole CSV traveled on every preview and
 * a single all-or-nothing apply. Real Enterprise exports (350k+ contacts)
 * produce tens of thousands of ambiguous matches, which made that flow
 * unusable — the CSV is now parsed/matched once into these tables and the
 * operator resolves/applies in paginated, quantified batches.
 *
 *  - `email_reconcile_sessions`: one working set per import job (PK job_id —
 *    re-running the match replaces the session). Carries the counters the UI
 *    shows plus a capped no-match sample.
 *  - `email_reconcile_items`: one row per matched masked contact. kind=auto
 *    rows are ready to apply; kind=ambiguous rows hold the top candidates
 *    (jsonb, sorted by name-similarity score) for operator/bulk resolution.
 *    Composite index (job_id, kind, status) drives pagination and batch
 *    selection; the (job_id, contact_id) unique index anchors resolutions.
 */
export class CreateEmailReconcileSessions1783000000000 implements MigrationInterface {
  private readonly sessionsTable = new Table({
    name: 'email_reconcile_sessions',
    columns: [
      { name: 'job_id', type: 'uuid', isPrimary: true },
      { name: 'account_id', type: 'integer', isNullable: false },
      { name: 'csv_rows', type: 'integer', isNullable: false },
      { name: 'invalid_csv_rows', type: 'integer', isNullable: false },
      { name: 'contacts_masked', type: 'integer', isNullable: false },
      { name: 'already_clean', type: 'integer', isNullable: false },
      { name: 'no_match_total', type: 'integer', isNullable: false },
      { name: 'no_match_sample', type: 'jsonb', isNullable: false, default: "'[]'" },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: false, default: 'NOW()' },
      { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: false, default: 'NOW()' },
    ],
    foreignKeys: [{ columnNames: ['job_id'], referencedTableName: 'enterprise_import_jobs', referencedColumnNames: ['id'], onDelete: 'CASCADE' }],
  });

  private readonly itemsTable = new Table({
    name: 'email_reconcile_items',
    columns: [
      { name: 'id', type: 'bigserial', isPrimary: true },
      { name: 'job_id', type: 'uuid', isNullable: false },
      { name: 'contact_id', type: 'integer', isNullable: false },
      { name: 'current_email', type: 'varchar', length: '255', isNullable: false },
      { name: 'contact_name', type: 'varchar', length: '255', isNullable: true },
      { name: 'kind', type: 'varchar', length: '16', isNullable: false },
      { name: 'status', type: 'varchar', length: '16', isNullable: false, default: "'pending'" },
      { name: 'new_email', type: 'varchar', length: '255', isNullable: true },
      { name: 'csv_row_number', type: 'integer', isNullable: true },
      { name: 'candidates', type: 'jsonb', isNullable: true },
      { name: 'candidates_total', type: 'integer', isNullable: true },
      { name: 'failure_reason', type: 'text', isNullable: true },
    ],
    foreignKeys: [
      { columnNames: ['job_id'], referencedTableName: 'email_reconcile_sessions', referencedColumnNames: ['job_id'], onDelete: 'CASCADE' },
      // CASCADE: a deleted contact simply drops out of the working set.
      { columnNames: ['contact_id'], referencedTableName: 'contacts', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
    ],
    indices: [
      { name: 'email_reconcile_items_job_kind_status_idx', columnNames: ['job_id', 'kind', 'status'] },
      { name: 'email_reconcile_items_job_contact_uq', columnNames: ['job_id', 'contact_id'], isUnique: true },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.sessionsTable, true);
    await queryRunner.createTable(this.itemsTable, true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.itemsTable, true);
    await queryRunner.dropTable(this.sessionsTable, true);
  }
}
