import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('events_logs')
export class EventsLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'events_logs_id' })
  eventsLogsId: number;

  @Column('timestamp with time zone', { name: 'time' })
  time: Date;

  @Column('date', { name: 'date' })
  date: Date;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'message_type', length: 40 })
  messageType: string;

  @Column('varchar', { name: 'event', length: 40 })
  event: string;

  @Column('int', { name: 'contact_id', nullable: true })
  contactId: number;

  @Column('int', { name: 'automation_id', nullable: true })
  automationId: number;

  @Column('int', { name: 'campaign_id', nullable: true })
  campaignId: number;

  @Column('int', { name: 'message_id', nullable: true })
  messageId: number;

  @Column('varchar', { name: 'email', nullable: true })
  email: string;

  @Column('varchar', { name: 'utm_campaign', nullable: true })
  utmCampaign: string;

  @Column('varchar', { name: 'provider', nullable: true })
  provider: string;

  @Column('boolean', { name: 'is_test_ab', nullable: true })
  isTestAb: boolean;

  @Column('varchar', { name: 'reason', length: 255, nullable: true })
  reason: string;

  @Column('varchar', { name: 'url', length: 500, nullable: true })
  url: string;

  @Column('inet', { name: 'ip', nullable: true })
  ip: string;

  @Column('varchar', { name: 'uuid', length: 40, nullable: true })
  uuid: string;

  @Column('int', { name: 'event_id', nullable: true })
  eventId: number;

  @Column('text', { name: 'user_agent', nullable: true })
  userAgent: string;

  @Column('boolean', { name: 'is_mobile', default: false })
  isMobile: boolean;

  @Column('varchar', { name: 'os', length: 40, nullable: true })
  os: string;

  @Column('varchar', { name: 'os_version', length: 40, nullable: true })
  osVersion: string;

  @Column('varchar', { name: 'browser', length: 40, nullable: true })
  browser: string;

  @Column('varchar', { name: 'pool', nullable: true })
  pool: string;

  @Column('int', { name: 'link_position', nullable: true })
  linkPosition: number;

  @Column('text', { name: 'value', nullable: true })
  value: string;

  @Column('numeric', { name: 'value_number', nullable: true })
  valueNumber: number;

  @Column('timestamp with time zone', { name: 'value_time', nullable: true })
  valueTime: Date;

  @Column('jsonb', { name: 'properties', nullable: true })
  properties: Record<string, any>;

  @Column('text', { name: 'country', nullable: true })
  country: string;

  @Column('text', { name: 'region', nullable: true })
  region: string;

  @Column('text', { name: 'city', nullable: true })
  city: string;

  @Column('text', { name: 'provider_account', nullable: true })
  providerAccount: string;

  @Column('int', { name: 'seconds_since_sent', nullable: true })
  secondsSinceSent: number;
}
