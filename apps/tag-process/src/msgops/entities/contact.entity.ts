import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToMany,
  AfterLoad,
} from 'typeorm';
import { ContactTagEntity } from './contact-tag.entity';
import { ContactAutomationEntity } from './contact-automation.entity';
import { ContactCustomFieldEntity } from './contact-custom-field.entity';
import { CustomField } from '../../interfaces';
import { ContactDeviceEntity } from './contact-device.entity';

@Entity('contacts')
export class ContactEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'uuid', length: 40 })
  uuid: string;

  @Column('varchar', { name: 'email', length: 255 })
  email: string;

  @Column('varchar', { name: 'email_provider', length: 255 })
  emailProvider: string;

  @Column('varchar', { name: 'first_name', length: 255 })
  firstName: string;

  @Column('varchar', { name: 'last_name', length: 255 })
  lastName: string;

  @Column('varchar', { name: 'hashed_email', length: 255 })
  hashedEmail: string;

  @Column('varchar', { name: 'phone', length: 255 })
  phone: string;

  @Column('varchar', { name: 'city', length: 255 })
  city: string;

  @Column('varchar', { name: 'region', length: 255 })
  region: string;

  @Column('varchar', { name: 'country', length: 255 })
  country: string;

  @Column('varchar', { name: 'postal', length: 255 })
  postal: string;

  @Column('varchar', { name: 'ip', length: 50 })
  ip: string;

  @Column('decimal', { precision: 10, scale: 7 })
  latitude: number;

  @Column('decimal', { precision: 10, scale: 7 })
  longitude: number;

  @Column('varchar', { name: 'timezone', length: 100 })
  timezone: string;

  @Column('bool', { name: 'is_active' })
  isActive: boolean;

  @Column('bool', { name: 'is_unsubscribed' })
  isUnsubscribed: boolean;

  @Column('bool', { name: 'is_valid' })
  isValid: boolean;

  @Column('bool', { name: 'has_bounced' })
  hasBounced: boolean;

  @Column('bool', { name: 'has_email' })
  hasEmail: boolean;

  @Column('timestamptz', { name: 'last_open' })
  lastOpen: Date;

  @Column('date', { name: 'last_open_date' })
  lastOpenDate: Date;

  @Column('timestamptz', { name: 'last_click' })
  lastClick: Date;

  @Column('date', { name: 'last_click_date' })
  lastClickDate: Date;

  @Column('timestamptz', { name: 'last_sent' })
  lastSent: Date;

  @Column('date', { name: 'last_sent_date' })
  lastSentDate: Date;

  @Column('timestamptz', { name: 'last_automation' })
  lastAutomation: Date;

  @Column('date', { name: 'last_automation_date' })
  lastAutomationDate: Date;

  @Column('int', { name: 'score' })
  score: number;

  @Column('int', { name: 'score_forecast' })
  scoreForecast: number;

  @Column('varchar', { name: 'last_vertical_type', length: 255 })
  lastVerticalType: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column('date', { name: 'created_at_date' })
  createdAtDate: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  fullName: string;

  @OneToMany(() => ContactTagEntity, (contactTag) => contactTag.contact, {
    eager: true,
    nullable: true,
  })
  tags: Array<ContactTagEntity> | Array<string>;

  @OneToMany(() => ContactCustomFieldEntity, (customFields) => customFields.contact, {
    eager: true,
    nullable: true,
    cascade: true,
  })
  customFields?: ContactCustomFieldEntity[] | CustomField;

  @OneToMany(() => ContactAutomationEntity, (contactAutomation) => contactAutomation.contact, {
    nullable: true,
  })
  contactAutomation: Array<ContactAutomationEntity>;

  @OneToMany(() => ContactDeviceEntity, (contactDevice) => contactDevice.contact, {
    eager: true,
    nullable: true,
  })
  contactDevices?: ContactDeviceEntity[];

  @AfterLoad()
  parseCustomFields() {
    if (Array.isArray(this.customFields)) {
      const keyValueObject = {};
      for (const customField of this.customFields) {
        if (customField.customFieldType && customField.customFieldType.name) {
          keyValueObject[customField.customFieldType.name] = customField.value;
        }
      }

      this.customFields = keyValueObject;
    }

    if (Array.isArray(this.tags)) {
      this.tags = this.tags.map((item) => item?.tag?.name || '');
    }

    this.fullName = `${this.firstName} ${this.lastName || ''}`.trim();
  }
}
