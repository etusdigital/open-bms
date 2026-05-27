import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountEntity } from './account.entity';

@Entity('automations')
export class AutomationEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'title', length: 255 })
  title: string;

  @Column('varchar', { name: 'name', length: 255 })
  name: string;

  @Column('bool', { name: 'active' })
  isActive: boolean;

  @Column('varchar', { name: 'type', length: 50 })
  type: string;

  @Column('jsonb', { name: 'steps' })
  steps: string;

  @Column('jsonb', { name: 'triggers' })
  triggers: any;

  @Column('bool', { name: 'is_rate_limit' })
  isRateLimit: boolean;

  @Column('varchar', { name: 'vertical_type', length: 255 })
  verticalType: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @Column('varchar', {
    name: 'version',
    length: 20,
    default: Date.now().toString(),
  })
  version?: string;

  @ManyToOne(() => AccountEntity, (account) => account.automations, {
    eager: false,
    nullable: true,
  })
  @JoinColumn([{ name: 'account_id', referencedColumnName: 'id' }])
  account: AccountEntity;
}
