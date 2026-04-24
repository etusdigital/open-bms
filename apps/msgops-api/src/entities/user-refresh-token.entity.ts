import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from './users.entity';

@Entity('user_refresh_tokens')
@Index('idx_user_refresh_tokens_user_id', ['userId'])
@Index('idx_user_refresh_tokens_expires', ['expiresAt'])
export class UserRefreshTokenEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: string;

  @Column('int', { name: 'user_id' })
  userId: number;

  @Column('varchar', { name: 'token_hash', length: 64, unique: true })
  tokenHash: string;

  @Column('timestamptz', { name: 'expires_at' })
  expiresAt: Date;

  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column('text', { name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column('inet', { name: 'ip', nullable: true })
  ip: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
