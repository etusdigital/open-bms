import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ip_reputation_daily')
export class IpReputationDailyEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'date', name: 'date' })
  date: string;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'provider_account', length: 255, nullable: true })
  providerAccount: string;

  @Column('varchar', { name: 'pool', length: 255, nullable: true })
  pool: string;

  @Column('varchar', { name: 'ip', length: 50, nullable: true })
  ip: string;

  @Column('int', { name: 'delivered', nullable: true, default: 0 })
  delivered: number;

  @Column('int', { name: 'open', nullable: true, default: 0 })
  open: number;

  @Column('int', { name: 'click', nullable: true, default: 0 })
  click: number;

  @Column('int', { name: 'deferred', nullable: true, default: 0 })
  deferred: number;

  @Column('int', { name: 'bounce', nullable: true, default: 0 })
  bounce: number;

  @Column('int', { name: 'spam_report', nullable: true, default: 0 })
  spamReport: number;

  @Column('int', { name: 'unsubscribe', nullable: true, default: 0 })
  unsubscribe: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
