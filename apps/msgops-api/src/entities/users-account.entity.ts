import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { AccountEntity } from './account.entity';
import { RoleEntity } from './role.entity';
import { UserEntity } from './users.entity';

@Entity('users_accounts')
export class UserAccountEntity {
  @PrimaryColumn({ type: 'int', name: 'user_id' })
  userId: number;

  @PrimaryColumn({ type: 'int', name: 'account_id' })
  accountId: number;

  @PrimaryColumn({ type: 'boolean', name: 'is_master_user' })
  isMasterUser: boolean;

  @Column({ type: 'int', name: 'role_override_role_id', nullable: true })
  roleOverrideRoleId?: number;

  @ManyToOne(() => UserEntity, (user) => user.userAccount)
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: UserEntity;

  @ManyToOne(() => AccountEntity, (account) => account.userAccount, {
    eager: true,
    nullable: false,
  })
  @JoinColumn([{ name: 'account_id', referencedColumnName: 'id' }])
  account: AccountEntity;

  @ManyToOne(() => RoleEntity, { eager: true, nullable: true })
  @JoinColumn([{ name: 'role_override_role_id', referencedColumnName: 'id' }])
  roleOverride?: RoleEntity;
}
