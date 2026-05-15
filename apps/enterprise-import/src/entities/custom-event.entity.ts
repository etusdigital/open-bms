import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('custom_events')
@Unique(['accountId', 'name'])
export class CustomEventEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'name', length: 40 })
  name: string;

  @Column('text', { name: 'description' })
  description?: string;

  @Column('boolean', { name: 'is_default' })
  isDefault?: boolean;

  @Column('jsonb', { name: 'properties' })
  properties: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;
}
