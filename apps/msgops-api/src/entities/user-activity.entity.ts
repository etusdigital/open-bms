import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from './users.entity';

@Entity('users_activities')
export class UserActivityEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'user_id', nullable: true })
  userId: number | null;

  @Column('varchar', { name: 'email', length: 255 })
  email: string;

  @Column('varchar', { name: 'action', length: 50 })
  action: string;

  @Column('varchar', { name: 'status', length: 20 })
  status: string;

  @Column('varchar', { name: 'ip_address', length: 45, nullable: true })
  ipAddress: string | null;

  @Column('varchar', { name: 'user_agent', length: 500, nullable: true })
  userAgent: string | null;

  @Column('jsonb', { name: 'headers', nullable: true })
  headers: Record<string, string> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity | null;
}
