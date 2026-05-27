import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('ip_reputation_daily')
export class IpReputationDaily {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'account_id', type: 'int' })
  accountId: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pool: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip: string | null;

  @Column({ name: 'provider_account', type: 'varchar', length: 255, nullable: true })
  providerAccount: string | null;

  @Column({ type: 'int', default: 0 })
  delivered: number;

  @Column({ type: 'int', default: 0 })
  open: number;

  @Column({ type: 'int', default: 0 })
  click: number;

  @Column({ type: 'int', default: 0 })
  deferred: number;

  @Column({ type: 'int', default: 0 })
  bounce: number;

  @Column({ name: 'spam_report', type: 'int', default: 0 })
  spamReport: number;

  @Column({ type: 'int', default: 0 })
  unsubscribe: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
