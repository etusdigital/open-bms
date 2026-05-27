import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { IpAssignment } from './ip-assignment.entity';

@Entity('ips')
export class Ip {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, unique: true })
  ipAddress: string;

  @Column({ type: 'varchar', length: 20 })
  provider: string;

  @Column({ name: 'acquired_at', type: 'date' })
  acquiredAt: string;

  @Column({ name: 'decommissioned_at', type: 'date', nullable: true })
  decommissionedAt: string | null;

  @Column({ name: 'last_30d_delivered', type: 'int', nullable: true })
  last30dDelivered: number | null;

  @Column({ name: 'usage_updated_at', type: 'timestamptz', nullable: true })
  usageUpdatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @OneToMany(() => IpAssignment, (assignment) => assignment.ip)
  assignments?: IpAssignment[];
}
