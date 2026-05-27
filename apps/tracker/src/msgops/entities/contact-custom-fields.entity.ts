import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { ContactEntity } from './contact.entity';
import { CustomFieldsEntity } from './custom-fields.entity';

@Entity('contacts_custom_fields')
export class ContactCustomFieldEntity {
  @PrimaryColumn('int', { name: 'contact_id' })
  contactId: number;

  @PrimaryColumn('int', { name: 'custom_field_id' })
  customFieldId: number;

  @Column('text', { name: 'value' })
  value: string;

  @ManyToOne(() => ContactEntity, (contact) => contact.customFields)
  @JoinColumn([{ name: 'contact_id', referencedColumnName: 'id' }])
  contact: ContactEntity;

  @OneToOne(() => CustomFieldsEntity, {
    eager: true,
    nullable: true,
  })
  @JoinColumn([{ name: 'custom_field_id', referencedColumnName: 'id' }])
  customFieldType?: CustomFieldsEntity;
}
