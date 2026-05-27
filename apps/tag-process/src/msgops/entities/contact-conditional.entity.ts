import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ContactTagEntity } from './contact-tag.entity';
import { ContactCustomFieldEntity } from './contact-custom-field.entity';
import { CustomField, CustomFieldKeyType } from 'src/interfaces';
import { ContactAutomationEntity } from './contact-automation.entity';

@Entity('contacts')
export class ContactConditionalEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'uuid', length: 40 })
  uuid: string;

  @Column('varchar', { name: 'email', length: 255 })
  email: string;

  @Column('varchar', { name: 'email_provider', length: 255 })
  email_provider: string;

  @Column('bool', { name: 'is_active' })
  isActive: boolean;

  @Column('bool', { name: 'is_unsubscribed' })
  isUnsubscribed: boolean;

  @Column('bool', { name: 'is_valid' })
  isValid: boolean;

  @Column('bool', { name: 'has_bounced' })
  hasBounced: boolean;

  @Column('timestamptz', { name: 'last_open' })
  last_open: Date;

  @Column('date', { name: 'last_open_date' })
  last_open_date: Date;

  @Column('timestamptz', { name: 'last_click' })
  last_click: Date;

  @Column('date', { name: 'last_click_date' })
  last_click_date: Date;

  @Column('timestamptz', { name: 'last_sent' })
  last_sent: Date;

  @Column('date', { name: 'last_sent_date' })
  last_sent_date: Date;

  @Column('timestamptz', { name: 'last_automation' })
  last_automation: Date;

  @Column('date', { name: 'last_automation_date' })
  last_automation_date: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @CreateDateColumn({ name: 'created_at_date', type: 'date' })
  created_at_date: Date;

  @Column('bool', { name: 'has_email', default: false })
  has_email: boolean;

  @Column('bool', { name: 'has_phone' })
  has_phone: boolean;

  @Column('bool', { name: 'has_web_push' })
  has_web_push: boolean;

  @Column('bool', { name: 'has_mobile_push' })
  has_mobile_push: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany('ContactTagEntity', 'contact', {
    eager: true,
    nullable: true,
  })
  tags: Array<ContactTagEntity> | any;

  @OneToMany('ContactCustomFieldEntity', 'contact', {
    eager: true,
    nullable: true,
    cascade: true,
  })
  customFields?: ContactCustomFieldEntity[] | CustomField;

  @OneToMany(() => ContactAutomationEntity, (contactAutomations) => contactAutomations.contact, {
    nullable: true,
    cascade: true,
  })
  contactAutomations?: ContactAutomationEntity[];

  parseCustomFields(keyType: CustomFieldKeyType) {
    if (Array.isArray(this.customFields)) {
      const keyValueObject = {};
      for (const customField of this.customFields) {
        if (keyType === CustomFieldKeyType.NAME) {
          keyValueObject[customField.customFieldType.name] =
            customField.number || customField.time || customField.value;
        } else {
          keyValueObject[customField.customFieldId] = customField.number || customField.time || customField.value;
        }
      }
      this.customFields = keyValueObject;
    }

    if (Array.isArray(this.tags)) {
      this.tags = this.tags.map((item) => item.tagId);
    }
  }
}
