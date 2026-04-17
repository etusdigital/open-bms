import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Ip } from './ip.entity';

@Entity('ip_assignments')
export class IpAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ip_id', type: 'integer' })
  ipId: number;

  @Column({ name: 'pool_id', type: 'integer', nullable: true })
  poolId: number | null;

  @Column({ name: 'pool_name', type: 'varchar', length: 255 })
  poolName: string;

  @Column({ name: 'account_id', type: 'integer', nullable: true })
  accountId: number | null;

  @Column({ name: 'assigned_at', type: 'timestamptz', default: () => 'NOW()' })
  assignedAt: Date;

  @Column({ name: 'assigned_by', type: 'varchar', length: 255, nullable: true })
  assignedBy: string | null;

  @Column({ name: 'removed_at', type: 'timestamptz', nullable: true })
  removedAt: Date | null;

  @Column({ name: 'removed_by', type: 'varchar', length: 255, nullable: true })
  removedBy: string | null;

  @Column({ name: 'sender_email', type: 'varchar', length: 255, nullable: true })
  senderEmail: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Ip, (ip) => ip.assignments)
  @JoinColumn({ name: 'ip_id' })
  ip?: Ip;
}
