import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('global_monitor_targets')
export class GlobalMonitorTarget {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'target_type', type: 'varchar', length: 20 })
  targetType: string;

  @Column({ name: 'target_value', type: 'varchar', length: 255 })
  targetValue: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
