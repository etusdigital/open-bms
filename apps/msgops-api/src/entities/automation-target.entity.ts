import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('automations_targets')
export class AutomationTargetEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('date', { name: 'date' })
  date: Date;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('int', { name: 'automation_id' })
  automationId: number;

  @Column('int', { name: 'count', default: 0 })
  count: number;
}
