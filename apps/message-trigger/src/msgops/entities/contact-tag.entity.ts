import { Entity, ManyToOne, JoinColumn, PrimaryColumn, Relation } from 'typeorm';
import type { ContactEntity } from './contact.entity';

@Entity('contacts_tags')
export class ContactTagEntity {
  @PrimaryColumn({ type: 'int', name: 'contact_id' })
  contactId: number;

  @PrimaryColumn({ type: 'int', name: 'tag_id' })
  tagId: number;

  @PrimaryColumn({ type: 'int', name: 'account_id' })
  accountId: number;

  @ManyToOne('ContactEntity', 'tags', { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'contact_id', referencedColumnName: 'id' },
    { name: 'account_id', referencedColumnName: 'accountId' },
  ])
  contact: Relation<ContactEntity>;
}
