import { Entity, Column, Unique, PrimaryColumn } from 'typeorm';

@Entity('events_statistics')
@Unique('events_statistics_primary_key', ['accountId', 'date', 'eventType', 'type', 'eventId', 'messageId', 'automationId', 'campaignId', 'isTestAb'])
export class EventStatisticsEntity {
  @PrimaryColumn({ type: 'date', nullable: false })
  date: Date;

  @Column({ type: 'integer', nullable: false })
  accountId: number;

  @Column({ type: 'text', nullable: false })
  eventType: string; // email, sms, web-push, mobile-push, custom-event

  @Column({ type: 'text', nullable: false })
  type: string; // campaign, automation, transactional

  @Column({ type: 'integer', nullable: false })
  messageId: number;

  @Column({ type: 'integer', nullable: false })
  automationId: number;

  @Column({ type: 'integer', nullable: false })
  campaignId: number;

  @Column({ type: 'boolean', default: false })
  isTestAb: boolean;

  @Column({ type: 'integer', nullable: true })
  eventId: number; // custom-event id

  @Column({ type: 'text', nullable: true })
  pool: string;

  @Column({ type: 'text', nullable: true })
  provider: string; // sendgrid, sparkpost

  // Event counts
  @Column({ type: 'integer', default: 0 })
  processed: number;

  @Column({ type: 'integer', default: 0 })
  delivered: number;

  @Column({ type: 'integer', default: 0 })
  open: number;

  @Column({ type: 'integer', default: 0 })
  uniqueOpen: number;

  @Column({ type: 'integer', default: 0 })
  click: number;

  @Column({ type: 'integer', default: 0 })
  uniqueClick: number;

  @Column({ type: 'integer', default: 0 })
  bounce: number;

  @Column({ type: 'integer', default: 0 })
  blocked: number;

  @Column({ type: 'integer', default: 0 })
  botClick: number;

  @Column({ type: 'integer', default: 0 })
  datacenterClick: number;

  @Column({ type: 'integer', default: 0 })
  spamReport: number;

  @Column({ type: 'integer', default: 0 })
  unsubscribe: number;

  @Column({ type: 'integer', default: 0 })
  deferred: number;

  @Column({ type: 'integer', default: 0 })
  sent: number;

  @Column({ type: 'integer', default: 0 })
  close: number;

  // JSONB columns
  @Column({ type: 'jsonb', default: {} })
  clickPosition: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  emailProvider: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  browser: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  os: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  device: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  country: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  region: Record<string, any>;
}
