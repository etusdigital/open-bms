import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, OneToMany, AfterLoad } from 'typeorm';
import { ContactCustomFieldEntity } from './contact-custom-field.entity';
import { CampaignContactEntity } from './campaign-contact.entity';
import { ContactDeviceEntity } from './contact-device.entity';
import { CustomField } from '../../interfaces';

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

  @Column('date', { name: 'unsubscribed_at' })
  unsubscribedAt: Date;

  @Column('bool', { name: 'is_blocked' })
  isBlocked: boolean;

  @Column('date', { name: 'blocked_at' })
  blockedAt: Date;

  @Column('bool', { name: 'is_valid' })
  isValid: boolean;

  @Column('bool', { name: 'has_bounced' })
  hasBounced: boolean;

  @Column('bool', { name: 'has_whatsapp' })
  hasWhatsapp: boolean;

  @Column('varchar', { name: 'whatsapp', length: 255 })
  whatsapp: string;

  @Column('bool', { name: 'has_mobile_push' })
  hasMobilePush: boolean;

  @Column('timestamptz', { name: 'last_open' })
  lastOpen: Date;

  @Column('timestamptz', { name: 'last_click' })
  lastClick: Date;

  @Column('timestamptz', { name: 'last_sent' })
  lastSent: Date;

  @Column('timestamptz', { name: 'last_automation' })
  lastAutomation: Date;

  @Column('int', { name: 'score' })
  score: number;

  @Column('int', { name: 'score_forecast' })
  scoreForecast: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @CreateDateColumn({ name: 'created_at_date', type: 'date' })
  createdAtDate: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  fullName: string;

  @OneToMany(() => CampaignContactEntity, (campaignContact) => campaignContact.contact, {
    nullable: true,
  })
  campaignContacts: Array<CampaignContactEntity>;

  @OneToMany(() => ContactCustomFieldEntity, (customFields) => customFields.contact, {
    eager: true,
    nullable: true,
  })
  customFields?: ContactCustomFieldEntity[] | CustomField;

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
        keyValueObject[customField.customFieldType.name] = customField.value;
      }

      this.customFields = keyValueObject;
    }

    this.fullName = `${this.firstName} ${this.lastName || ''}`.trim();
  }
}
