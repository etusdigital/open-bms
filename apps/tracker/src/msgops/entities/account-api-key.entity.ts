import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}
