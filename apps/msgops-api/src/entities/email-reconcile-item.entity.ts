import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type EmailReconcileItemKind = 'auto' | 'ambiguous';
// `conflict` = the chosen address already belongs to another contact in the
// account. Terminal for the automatic passes (retrying would fail identically)
// but NOT a dead end: the operator resolves it manually, or reopens it after
// freeing the address. `failed` stays for genuine write errors.
export type EmailReconcileItemStatus = 'pending' | 'applied' | 'skipped' | 'failed' | 'conflict';

export interface EmailReconcileStoredCandidate {
  csvRowNumber: number;
  csvName: string;
  csvEmail: string;
  // Jaccard token similarity between the contact name and csvName (0..1).
  // Candidates are stored sorted by it, best first, so bulk best-name
  // resolution reads candidates[0] without recomputing.
  score: number;
  // created_at agreement with the contact (2 exact, 1 same day, 0 none).
  // Absent on sessions persisted before the field existed.
  timeMatch?: number;
}

// One row per masked contact the reconcile session has an outcome for.
//   kind=auto      → unique/confident match; new_email already decided.
//   kind=ambiguous → operator (or bulk strategy) must pick a candidate.
// Status walks pending → applied|skipped|failed|conflict. Contacts with no CSV
// match get no item — they are only counted on the session row.
@Entity('email_reconcile_items')
@Index('email_reconcile_items_job_kind_status_idx', ['jobId', 'kind', 'status'])
@Index('email_reconcile_items_job_contact_uq', ['jobId', 'contactId'], { unique: true })
export class EmailReconcileItemEntity {
  @PrimaryGeneratedColumn('increment', { name: 'id', type: 'bigint' })
  id: string;

  @Column('uuid', { name: 'job_id' })
  jobId: string;

  @Column('integer', { name: 'contact_id' })
  contactId: number;

  @Column('varchar', { name: 'current_email', length: 255 })
  currentEmail: string;

  @Column('varchar', { name: 'contact_name', length: 255, nullable: true })
  contactName: string | null;

  @Column('varchar', { name: 'kind', length: 16 })
  kind: EmailReconcileItemKind;

  @Column('varchar', { name: 'status', length: 16, default: 'pending' })
  status: EmailReconcileItemStatus;

  // For kind=auto: filled at session create. For kind=ambiguous: filled when
  // the item is resolved (operator pick or bulk strategy).
  @Column('varchar', { name: 'new_email', length: 255, nullable: true })
  newEmail: string | null;

  @Column('integer', { name: 'csv_row_number', nullable: true })
  csvRowNumber: number | null;

  // kind=ambiguous only: top candidates sorted by score desc, capped — enough
  // for the operator UI and for bulk best-name resolution.
  @Column('jsonb', { name: 'candidates', nullable: true })
  candidates: EmailReconcileStoredCandidate[] | null;

  // Real candidate count before the cap, so the UI can say "showing 20 of N".
  @Column('integer', { name: 'candidates_total', nullable: true })
  candidatesTotal: number | null;

  @Column('text', { name: 'failure_reason', nullable: true })
  failureReason: string | null;
}
