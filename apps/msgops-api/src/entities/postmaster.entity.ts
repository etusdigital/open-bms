import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('postmaster')
export class PostmasterEntity {
  @PrimaryColumn('varchar', { name: 'domain', length: 255 })
  domain: string;

  @PrimaryColumn('varchar', { name: 'ip', length: 50 })
  ip: string;

  @PrimaryColumn('timestamptz', { name: 'time' })
  time: number;

  @PrimaryColumn('date', { name: 'date' })
  date: Date;

  @Column('varchar', { name: 'reputation', length: 255 })
  reputation: string;

  @Column('varchar', { name: 'domain_reputation', length: 255 })
  domainReputation: string;

  @Column('decimal', { name: 'user_reported_spam_ratio', precision: 10, scale: 7 })
  spamRatio: number;

  @Column('jsonb', { name: 'spam_feedback_loops' })
  spamLoops: any;

  @Column('decimal', { name: 'spf_success_ratio', precision: 10, scale: 7 })
  spfRatio: number;

  @Column('decimal', { name: 'dkim_success_ratio', precision: 10, scale: 7 })
  dkimRatio: number;

  @Column('decimal', { name: 'dmarc_success_ratio', precision: 10, scale: 7 })
  dmarcRatio: number;

  @Column('decimal', { name: 'inbound_encryption_ratio', precision: 10, scale: 7 })
  inboundRatio: number;

  @Column('jsonb', { name: 'delivery_errors' })
  deliveryErrors: any;
}
