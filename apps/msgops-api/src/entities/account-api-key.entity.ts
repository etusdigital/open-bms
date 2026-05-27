import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { AccountEntity } from './account.entity';
import { RoleEntity } from './role.entity';
import { UserEntity } from './users.entity';

@Entity('accounts_api_keys')
@Unique(['keyHash'])
export class AccountApiKeyEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'name', length: 120 })
  name: string;

  @Column('varchar', { name: 'key_hash', length: 128 })
  keyHash: string;

  @Column('int', { name: 'role_id' })
  roleId: number;

  @Column('varchar', { name: 'status', length: 20, default: 'active' })
  status: string;

  @Column('timestamptz', { name: 'expires_at', nullable: true })
  expiresAt?: Date;

  @Column('timestamptz', { name: 'last_used_at', nullable: true })
  lastUsedAt?: Date;

  @Column('int', { name: 'created_by_user_id', nullable: true })
  createdByUserId?: number;

  @Column('varchar', { name: 'source', length: 20, default: 'managed' })
  source: string;

  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  revokedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => AccountEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'account_id', referencedColumnName: 'id' }])
  account: AccountEntity;

  @ManyToOne(() => RoleEntity, { eager: true, nullable: false })
  @JoinColumn([{ name: 'role_id', referencedColumnName: 'id' }])
  role: RoleEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn([{ name: 'created_by_user_id', referencedColumnName: 'id' }])
  createdByUser?: UserEntity;
}
