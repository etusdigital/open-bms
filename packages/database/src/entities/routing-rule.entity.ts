import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('routing_rules')
@Index('idx_routing_rules_account', ['accountId'])
export class RoutingRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id', type: 'integer' })
  accountId: number;

  @Column({ type: 'jsonb' })
  config: Record<string, unknown>;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
