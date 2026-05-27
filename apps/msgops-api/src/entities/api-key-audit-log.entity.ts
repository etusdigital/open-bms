import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('api_key_audit_logs')
export class ApiKeyAuditLogEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('int', { name: 'user_id', nullable: true })
  userId: number;

  @Column('varchar', { name: 'user_email', length: 255, nullable: true })
  userEmail: string;

  @Column('varchar', { name: 'action', length: 50 })
  action: string;

  @Column('varchar', { name: 'key_type', length: 50 })
  keyType: string;

  @Column('varchar', { name: 'token', length: 64, nullable: true })
  token: string;

  @Column('varchar', { name: 'ip_address', length: 255, nullable: true })
  ipAddress: string;

  @Column('text', { name: 'user_agent', nullable: true })
  userAgent: string;

  @Column('varchar', { name: 'old_key_prefix', length: 8, nullable: true })
  oldKeyPrefix: string;

  @Column('varchar', { name: 'new_key_prefix', length: 8, nullable: true })
  newKeyPrefix: string;

  @Column('boolean', { name: 'success', default: true })
  success: boolean;

  @Column('json', { name: 'metadata', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
