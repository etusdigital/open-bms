import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

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

  @Column('timestamptz', { name: 'unsubscribed_at' })
  unsubscribedAt: Date;

  @Column('bool', { name: 'is_blocked' })
  isBlocked: boolean;

  @Column('timestamptz', { name: 'blocked_at' })
  blockedAt: Date;

  @Column('bool', { name: 'is_valid' })
  isValid: boolean;

  @Column('bool', { name: 'has_bounced' })
  hasBounced: boolean;

  @Column('varchar', { name: 'bounce_type', length: 4, nullable: true })
  bounceType: 'HARD' | 'SOFT' | null;

  @Column('timestamptz', { name: 'bounced_at', nullable: true })
  bouncedAt: Date;

  @Column('bool', { name: 'has_email', default: false })
  hasEmail: boolean;

  @Column('bool', { name: 'has_phone' })
  hasPhone: boolean;

  @Column('bool', { name: 'has_web_push' })
  hasWebPush: boolean;

  @Column('bool', { name: 'has_mobile_push' })
  hasMobilePush: boolean;

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

  @Column('varchar', { name: 'whatsapp', length: 255 })
  whatsapp: string;

  @Column('bool', { name: 'has_whatsapp' })
  hasWhatsapp: boolean;

  @Column('date', { name: 'whatsapp_last_sent' })
  whatsappLastSent: Date;

  @Column('date', { name: 'whatsapp_last_delivered' })
  whatsappLastDelivered: Date;

  @Column('date', { name: 'whatsapp_last_open' })
  whatsappLastOpen: Date;

  @Column('date', { name: 'whatsapp_last_click' })
  whatsappLastClick: Date;

  @Column('date', { name: 'sms_last_sent' })
  smsLastSent: Date;

  @Column('date', { name: 'sms_last_delivered' })
  smsLastDelivered: Date;

  @Column('date', { name: 'sms_last_click' })
  smsLastClick: Date;

  @Column('varchar', { name: 'last_vertical_type', length: 255, nullable: true })
  lastVerticalType?: string;

  @Column('jsonb', { name: 'properties' })
  properties: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @CreateDateColumn({ name: 'created_at_date', type: 'date' })
  createdAtDate: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
