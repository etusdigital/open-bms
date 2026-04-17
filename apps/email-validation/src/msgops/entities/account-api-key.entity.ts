import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AccountEntity } from './account.entity';

@Entity('accounts_api_keys')
export class AccountApiKeyEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'key_hash', length: 128 })
  keyHash: string;

  @Column('varchar', { name: 'status', length: 20, default: 'active' })
  status: string;

  @Column('timestamptz', { name: 'expires_at', nullable: true })
  expiresAt?: Date;

  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  revokedAt?: Date;

  @ManyToOne(() => AccountEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'account_id', referencedColumnName: 'id' }])
  account: AccountEntity;
}
