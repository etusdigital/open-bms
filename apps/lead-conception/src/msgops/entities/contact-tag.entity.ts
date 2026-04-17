import { Entity, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { ContactEntity } from './contact.entity';
import { TagEntity } from './tag.entity';

@Entity('contacts_tags')
export class ContactTagEntity {
  @PrimaryColumn({ type: 'int', name: 'contact_id' })
  contactId: number;

  @PrimaryColumn({ type: 'int', name: 'tag_id' })
  tagId: number;

  @PrimaryColumn({ type: 'int', name: 'account_id' })
  accountId: number;

  @ManyToOne(() => ContactEntity, (contact) => contact.contactTag)
  @JoinColumn([{ name: 'contact_id', referencedColumnName: 'id' }])
  contact: ContactEntity;

  @ManyToOne(() => TagEntity, (tag) => tag.contactTag)
  @JoinColumn([{ name: 'tag_id', referencedColumnName: 'id' }])
  tag: TagEntity;
}
