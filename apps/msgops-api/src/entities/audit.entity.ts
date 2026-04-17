import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
@Entity('audits')
export class AuditEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'entity', length: 255 })
  entity: string;

  @Column('int', { name: 'entity_id' })
  entityId: number;

  @Column('varchar', { name: 'type', length: 255 })
  type: string;

  @Column('json', { name: 'old_values' })
  oldValues: any;

  @Column('json', { name: 'new_values' })
  newValues: any;

  @Column('varchar', { name: 'user', length: 600 })
  user: string;

  @Column('varchar', { name: 'ip_address', length: 600 })
  ipAddress: string;

  @Column('varchar', { name: 'user_agent', length: 600 })
  userAgent: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;
}
