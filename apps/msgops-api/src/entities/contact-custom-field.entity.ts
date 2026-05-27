import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { ContactEntity } from './contact.entity';
import { CustomFieldsEntity } from './custom-fields.entity';

@Entity('contacts_custom_fields')
export class ContactCustomFieldEntity {
  @PrimaryColumn('int', { name: 'contact_id' })
  contactId: number;

  @PrimaryColumn('int', { name: 'custom_field_id' })
  customFieldId: number;

  // account_id was previously only referenced via @JoinColumn on the relations
  // below, so TypeORM silently dropped it from INSERT payloads — every write
  // that passed `accountId` ended up with `account_id = NULL`. The EVO-1278
  // migration tightened the column to NOT NULL, turning that latent bug into a
  // guaranteed 500. Declaring it as @PrimaryColumn matches the unique key
  // (account_id, contact_id, custom_field_id) and makes
  // QueryBuilder.values({ accountId }) actually map to the column.
  @PrimaryColumn('int', { name: 'account_id' })
  accountId: number;

  @Column('text', { name: 'value' })
  value: string;

  @Column('timestamptz', { name: 'time' })
  time: Date;

  @Column('decimal', { name: 'number' })
  number: number;

  @ManyToOne(() => ContactEntity, (contact) => contact.customFields, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'contact_id', referencedColumnName: 'id' },
    { name: 'account_id', referencedColumnName: 'accountId' },
  ])
  contact: ContactEntity;

  @OneToOne(() => CustomFieldsEntity, {
    eager: true,
    nullable: true,
  })
  @JoinColumn([
    { name: 'custom_field_id', referencedColumnName: 'id' },
    { name: 'account_id', referencedColumnName: 'accountId' },
  ])
  customFieldType?: CustomFieldsEntity;
}
