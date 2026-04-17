import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ContactTagEntity } from './contact-tag.entity';
import { ContactCustomFieldEntity } from './contact-custom-field.entity';
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

  @Column('bool', { name: 'has_email', default: false })
  hasEmail: boolean;

  @Column('bool', { name: 'has_phone', default: false })
  hasPhone: boolean;

  @Column('bool', { name: 'has_web_push', default: false })
  hasWebPush: boolean;

  @Column('bool', { name: 'has_mobile_push' })
  hasMobilePush: boolean;

  @Column('timestamp', { name: 'last_open' })
  lastOpen: Date;

  @Column('timestamp', { name: 'last_click' })
  lastClick: Date;

  @Column('timestamp', { name: 'last_sent' })
  lastSent: Date;

  @Column('timestamp', { name: 'last_automation' })
  lastAutomation: Date;

  @Column('int', { name: 'score' })
  score: number;

  @Column('int', { name: 'score_forecast' })
  scoreForecast: number;

  @Column('varchar', { name: 'whatsapp', length: 255 })
  whatsapp: string;

  @Column('bool', { name: 'has_whatsapp', default: false })
  hasWhatsapp: boolean;

  @Column('date', { name: 'whatsapp_last_sent' })
  whatsappLastSent: Date;

  @Column('date', { name: 'whatsapp_last_delivered' })
  whatsappLastDelivered: Date;

  @Column('date', { name: 'whatsapp_last_open' })
  whatsappLastOpen: Date;

  @Column('date', { name: 'whatsapp_last_click' })
  whatsappLastClick: Date;

  @Column('varchar', { name: 'last_vertical_type', length: 255 })
  lastVerticalType: string;

  @Column('jsonb', { name: 'properties', nullable: true })
  properties?: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'created_at_date', type: 'date' })
  createdAtDate: Date | string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ContactTagEntity, (contactTag) => contactTag.contact, {
    eager: false,
    nullable: true,
  })
  contactTag: Array<ContactTagEntity>;

  @OneToMany(() => ContactCustomFieldEntity, (customFields) => customFields.contact, {
    eager: true,
    nullable: true,
    cascade: true,
  })
  customFields?: ContactCustomFieldEntity[];

  @OneToMany(() => ContactDeviceEntity, (contactDevice) => contactDevice.contact, {
    eager: true,
    nullable: true,
  })
  contactDevices?: ContactDeviceEntity[];

  public get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  getMailBoxProvider(email: string): string {
    const domain = email.toLowerCase().split('@')[1];

    const gmail = ['gmail.com', 'googlemail.com', 'google.com'];
    if (gmail.includes(domain)) {
      return 'Gmail';
    }

    if (domain.includes('yahoo')) {
      return 'Yahoo';
    }

    const microsoft = ['hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'passport.com'];
    if (microsoft.some((x) => domain.includes(x))) {
      return 'Microsoft';
    }

    const icloud = ['icloud.com', 'me.com', 'mac.com'];
    if (icloud.includes(domain)) {
      return 'iCloud';
    }

    return 'Other';
  }
}
