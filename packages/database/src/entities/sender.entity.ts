import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SoftDeleteEntity } from './base.entity';
import { SubAccount } from './sub-account.entity';

@Entity('senders')
export class Sender extends SoftDeleteEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sub_account_id', type: 'integer' })
  subAccountId: number;

  @Column({ name: 'from_name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'from_mail', type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'reply_to_mail', type: 'varchar', length: 255, nullable: true })
  replyToEmail: string | null;

  // NÃO usar unique: true aqui — unicidade garantida pelo partial index da migration
  // (WHERE deleted_at IS NULL). unique: true criaria um índice global que bloquearia
  // reutilização de pool_name após soft delete.
  @Column({ name: 'pool_name', type: 'varchar', length: 255 })
  poolName: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  ips: string[];

  @Column({ name: 'rate_limit_per_hour', type: 'integer', nullable: true })
  rateLimitPerHour: number | null;

  @Column({ name: 'rate_limit_per_day', type: 'integer', nullable: true })
  rateLimitPerDay: number | null;

  @Column({ name: 'sendgrid_domain_id', type: 'integer', nullable: true })
  sendgridDomainId: number | null;

  @Column({ name: 'sendgrid_dns', type: 'jsonb', nullable: true })
  sendgridDns: Record<string, any> | null;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @ManyToOne(() => SubAccount, (sa) => sa.senders)
  @JoinColumn({ name: 'sub_account_id' })
  subAccount: SubAccount;
}
