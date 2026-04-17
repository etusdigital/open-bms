import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('leads')
export class LeadsEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'contact_id' })
  contactId: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'uuid', length: 40 })
  uuid: string;

  @Column('varchar', { name: 'transaction_id', length: 100 })
  transactionId?: string;

  @Column('varchar', { name: 'email', length: 255 })
  email?: string;

  @Column('varchar', { name: 'hashed_email', length: 255 })
  hashedEmail?: string;

  @Column('varchar', { name: 'email_provider', length: 40 })
  emailProvider?: string;

  @Column('varchar', { name: 'phone', length: 40 })
  phone?: string;

  @Column('varchar', { name: 'first_name', length: 255 })
  firstName: string;

  @Column('varchar', { name: 'last_name', length: 255 })
  lastName?: string;

  @Column('varchar', { name: 'city', length: 255 })
  city?: string;

  @Column('varchar', { name: 'region', length: 255 })
  region?: string;

  @Column('varchar', { name: 'country', length: 255 })
  country?: string;

  @Column('varchar', { name: 'ip', length: 50 })
  ip?: string;

  @Column('decimal', { precision: 10, scale: 7 })
  latitude?: number;

  @Column('decimal', { precision: 10, scale: 7 })
  longitude?: number;

  @Column('varchar', { name: 'timezone', length: 100 })
  timezone?: string;

  @Column('text', { name: 'clid' })
  clid?: string;

  @Column('text', { name: 'ad_id' })
  ad_id?: string;

  @Column('text', { name: 'adgroup_id' })
  adgroup_id?: string;

  @Column('text', { name: 'adset_id' })
  adset_id?: string;

  @Column('text', { name: 'placement' })
  placement?: string;

  @Column('text', { name: 'campaign_id' })
  campaign_id?: string;

  @Column('text', { name: 'utm_source' })
  utm_source?: string;

  @Column('text', { name: 'utm_medium' })
  utm_medium?: string;

  @Column('text', { name: 'utm_content' })
  utm_content?: string;

  @Column('text', { name: 'utm_campaign' })
  utm_campaign?: string;

  @Column('text', { name: 'utm_term' })
  utm_term?: string;

  @Column('text', { name: 'utm_keyword' })
  utm_keyword?: string;

  @Column('jsonb', { name: 'questions' })
  questions?: object;

  @Column('jsonb', { name: 'forms' })
  forms?: object;

  @Column('jsonb', { name: 'query_string' })
  queryString?: object;

  @Column('bool', { name: 'is_valid', default: false })
  isValid?: boolean;

  @Column('text', { name: 'invalid_reason' })
  invalidReason?: string;

  @Column('text', { name: 'lead_source' })
  leadSource?: string;

  @Column('jsonb', { name: 'custom_fields' })
  customFields?: object;

  @Column('text', { name: 'source_url' })
  sourceUrl?: string;

  @Column('text', { name: 'direct_to_url' })
  directToUrl?: string;

  @Column('text', { name: 'user_agent' })
  userAgent?: string;

  @Column('varchar', { name: 'engaged', length: 50 })
  engaged: string;

  @Column('varchar', { name: 'status', length: 255 })
  status: string;

  @Column('varchar', { name: 'tag_name', length: 255 })
  tagName: string;

  @Column('int', { name: 'automation_id' })
  automationId?: number;

  @Column('varchar', { name: 'automation_title', length: 255 })
  automationTitle?: string;

  @Column('varchar', { name: 'automation_status', length: 20 })
  automationStatus?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @CreateDateColumn({ name: 'created_at_date', type: 'date' })
  createdAtDate: Date | string;
}
