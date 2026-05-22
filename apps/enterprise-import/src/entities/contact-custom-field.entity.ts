import { Column, Entity, PrimaryColumn } from 'typeorm';

// Join table linking contacts to custom-field VALUES. Lean copy (no relations)
// of the msgops-api entity: the importer only reads/writes these columns.
// `value` is NOT NULL; `time`/`number` are nullable; `account_id` scopes the
// row. created_at/updated_at use their DB defaults.
@Entity('contacts_custom_fields')
export class ContactCustomFieldEntity {
  @PrimaryColumn('int', { name: 'contact_id' })
  contactId: number;

  @PrimaryColumn('int', { name: 'custom_field_id' })
  customFieldId: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('text', { name: 'value' })
  value: string;

  @Column('timestamptz', { name: 'time', nullable: true })
  time: Date | null;

  @Column('decimal', { name: 'number', nullable: true })
  number: number | null;
}
