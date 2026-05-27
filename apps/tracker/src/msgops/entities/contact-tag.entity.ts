import { Entity, PrimaryColumn } from 'typeorm';

@Entity('contacts_tags')
export class ContactTagEntity {
  @PrimaryColumn({ type: 'int', name: 'contact_id' })
  contactId: number;

  @PrimaryColumn({ type: 'int', name: 'tag_id' })
  tagId: number;

  @PrimaryColumn({ type: 'int', name: 'account_id' })
  accountId: number;
}
