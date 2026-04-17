import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('pools')
export class Pool {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id', type: 'integer', nullable: true })
  accountId: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ name: 'pool_name', type: 'varchar', length: 255, nullable: true })
  poolName: string;

  @Column({ name: 'sender_name', type: 'varchar', length: 255, nullable: true })
  senderName: string;

  @Column({ name: 'sender_email', type: 'varchar', length: 255, nullable: true })
  senderEmail: string;

  @Column({ name: 'sender_replyto_email', type: 'varchar', length: 255, nullable: true })
  senderReplytoEmail: string;

  @Column({ type: 'jsonb', nullable: true })
  ip: string[];

  @Column({ name: 'ips_all', type: 'jsonb', nullable: true })
  ipsAll: string[];

  @Column({ name: 'sending_limit', type: 'integer', nullable: true })
  sendingLimit: number;

  @Column({ name: 'is_warmup', type: 'integer', default: 0 })
  isWarmup: number;

  @Column({ name: 'is_default', type: 'boolean', nullable: true })
  isDefault: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subuser: string;

  @Column({ name: 'sendgrid_domain_id', type: 'integer', nullable: true })
  sendgridDomainId: number;

  @Column({ name: 'is_sendgrid_authenticated', type: 'boolean', default: false })
  isSendgridAuthenticated: boolean;

  @Column({ name: 'sendgrid_dns', type: 'jsonb', nullable: true })
  sendgridDns: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
