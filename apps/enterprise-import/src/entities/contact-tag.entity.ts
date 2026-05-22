import { Entity, PrimaryColumn } from 'typeorm';

// Join table linking contacts to tags. Lean copy (no relations) of the
// msgops-api entity: the importer only reads/writes the three key columns.
// `is_active` (NOT NULL DEFAULT true) is intentionally omitted so inserts let
// the DB default apply, matching the canonical write path in contacts.service.
@Entity('contacts_tags')
export class ContactTagEntity {
  @PrimaryColumn({ type: 'int', name: 'contact_id' })
  contactId: number;

  @PrimaryColumn({ type: 'int', name: 'tag_id' })
  tagId: number;

  @PrimaryColumn({ type: 'int', name: 'account_id' })
  accountId: number;
}
