import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, OneToMany, BeforeInsert, BeforeUpdate, AfterInsert, AfterLoad } from 'typeorm';
import { createHash } from 'crypto';
import { ContactTagEntity } from './contact-tag.entity';
import { ContactCustomFieldEntity } from './contact-custom-field.entity';
import { ContactAutomationEntity } from './contact-automation.entity';
import { ContactDeviceEntity } from './contact-device.entity';
import { maskEmail } from '../utils/masking/email-masker';

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

  fullName: string;

  maskedEmail: string;

  // TODO: Delete related content (contactTags, contactCustomFields, contactAutomations)
  // before delete contact. It could be done by the database but since we're using partition
  // it need to be done manually, so in case we add the option to delete contacts in the future
  @OneToMany(() => ContactTagEntity, (contactTag) => contactTag.contact, {
    eager: true,
    nullable: true,
    cascade: true,
  })
  contactTag: Array<ContactTagEntity>;

  @OneToMany(() => ContactCustomFieldEntity, (customFields) => customFields.contact, {
    eager: true,
    nullable: true,
    cascade: true,
  })
  customFields?: ContactCustomFieldEntity[];

  @OneToMany(() => ContactAutomationEntity, (contactAutomation) => contactAutomation.contact, {
    eager: true,
    nullable: true,
    cascade: true,
  })
  contactAutomation?: ContactAutomationEntity[];

  @OneToMany(() => ContactDeviceEntity, (contactDevice) => contactDevice.contact, {
    eager: true,
    nullable: true,
    cascade: true,
  })
  contactDevices?: ContactDeviceEntity[];

  // Runs on both insert and update so the email-derived fields
  // (email_provider, hashed_email) are never left stale. `hasPhone` is
  // guarded: on a partial update where `phone` is not loaded, leaving it
  // alone avoids clobbering the persisted value to false.
  @BeforeInsert()
  @BeforeUpdate()
  setUserDetails() {
    if (this.email) {
      this.email = this.email.toLowerCase();
      this.emailProvider = this.getMailBoxProvider(this.email);
      this.hashedEmail = createHash('sha256').update(this.email).digest('hex');
      this.hasEmail = true;
    }

    if (this.phone !== undefined) {
      // Normalize to digits-only before persisting so every downstream
      // consumer sees the same shape. WhatsApp Cloud's POST /{phone_id}/messages
      // rejects masks like "(31) 99574-3631"; CSV imports, the BMS lead pixel,
      // and the in-app form all funnel through this listener.
      // Auto-prepend the Brazilian DDI 55 when the number has 10-11 digits
      // (legacy landline / mobile with or without the leading 9) — already-
      // E.164 numbers (12+ digits) are left alone so foreign or pre-formatted
      // inputs survive a round-trip.
      this.phone = ContactEntity.normalizePhone(this.phone);
      this.hasPhone = !!this.phone;
      this.hasWhatsapp = !!this.phone;
      if (this.phone && !this.whatsapp) {
        this.whatsapp = this.phone;
      }
    }
    if (this.whatsapp !== undefined) {
      // Apply digits-only on an explicit whatsapp value too, but never
      // auto-prepend the DDI here: callers that split phone ≠ whatsapp
      // are signaling intent, and silently mutating their number would be
      // surprising. Pre-formatted E.164 inputs already come with the DDI.
      this.whatsapp = this.whatsapp ? String(this.whatsapp).replace(/\D+/g, '') : '';
      // Mirror the flag so the UI ("Não enviável" badge) and segmentation
      // (campaigns filter by has_whatsapp) see the channel as available.
      // Without this, a write that lands the number leaves the flag stale.
      this.hasWhatsapp = !!this.whatsapp;
    }
  }

  static normalizePhone(input: string | null | undefined): string {
    if (!input) return '';
    const digits = String(input).replace(/\D+/g, '');
    if (!digits) return '';
    return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  }

  @AfterInsert()
  setUUID() {
    this.uuid = createHash('sha1').update(`BMS${this.id}`).digest('hex');
  }

  @AfterLoad()
  setExtraFields() {
    this.fullName = `${this.firstName} ${this.lastName || ''}`.trim();
    this.maskedEmail = maskEmail(this.email);
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
