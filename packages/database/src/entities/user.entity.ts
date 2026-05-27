import { Entity, Column, OneToMany, Index, PrimaryGeneratedColumn } from 'typeorm';
import { UserAccount } from './user-account.entity';
import { SoftDeleteEntity } from './base.entity';

export interface UserSettings {
  language?: string;
  locale?: string;
  timezone?: string;
  /** When true, the "Only External Accounts" option is hidden in the account selector. */
  hideExternalAccounts?: boolean;
}

@Entity('users')
@Index('index_user_email', ['email'], { unique: true })
export class User extends SoftDeleteEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 500 })
  profile: string;

  @Column({ name: 'provider_id', type: 'varchar', length: 255, nullable: true })
  providerId: string;

  @Column({ name: 'is_super_admin', type: 'boolean', default: false })
  isSuperAdmin: boolean;

  @Column({
    type: 'json',
    nullable: true,
    default: () => '\'{"language": "pt-BR"}\'',
  })
  settings: UserSettings;

  @OneToMany(() => UserAccount, (userAccount) => userAccount.user, {
    eager: true,
  })
  userAccounts?: UserAccount[];
}
