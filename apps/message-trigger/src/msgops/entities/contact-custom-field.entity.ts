import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn, Relation } from 'typeorm';
import { ContactEntity } from './contact.entity';
import { CustomFieldsEntity } from './custom-fields.entity';

@Entity('contacts_custom_fields')
export class ContactCustomFieldEntity {
  @PrimaryColumn('int', { name: 'account_id' })
  accountId: number;

  @PrimaryColumn('int', { name: 'contact_id' })
  contactId: number;

  @PrimaryColumn('int', { name: 'custom_field_id' })
  customFieldId: number;

  @Column('text', { name: 'value' })
  value?: string;

  @Column('timestamptz', { name: 'time' })
  time?: Date;

  @Column('decimal', { name: 'number' })
  number?: number;

  @ManyToOne('ContactEntity', 'customFields')
  @JoinColumn([
    { name: 'contact_id', referencedColumnName: 'id' },
    { name: 'account_id', referencedColumnName: 'accountId' },
  ])
  contact?: Relation<ContactEntity>;

  @OneToOne(() => CustomFieldsEntity, {
    eager: false,
    nullable: true,
  })
  @JoinColumn([
    { name: 'custom_field_id', referencedColumnName: 'id' },
    { name: 'account_id', referencedColumnName: 'accountId' },
  ])
  customFieldType?: Relation<CustomFieldsEntity>;
}
