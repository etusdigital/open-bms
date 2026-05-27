import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('retention_alerts')
@Index('idx_ra_active', ['resolvedAt'])
@Index('idx_ra_detected', ['detectedAt'])
@Index('idx_ra_account', ['accountId', 'detectedAt'])
export class RetentionAlert {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'account_id', type: 'integer', nullable: true })
  accountId: number;

  @Column({ name: 'alert_type', type: 'varchar', length: 50 })
  alertType: string;

  @Column({ type: 'varchar', length: 20 })
  severity: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'metric_name', type: 'varchar', length: 100, nullable: true })
  metricName: string;

  @Column({ name: 'current_value', type: 'real', nullable: true })
  currentValue: number;

  @Column({ name: 'baseline_value', type: 'real', nullable: true })
  baselineValue: number;

  @Column({ name: 'threshold_pct', type: 'real', nullable: true })
  thresholdPct: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pool: string;

  @Column({ name: 'provider_account', type: 'varchar', length: 255, nullable: true })
  providerAccount: string;

  @Column({ name: 'detected_at', type: 'timestamptz' })
  detectedAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date;

  @Column({ name: 'acknowledged_by', type: 'varchar', length: 255, nullable: true })
  acknowledgedBy: string;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ name: 'monitor_target_id', type: 'integer', nullable: true })
  monitorTargetId: number | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
