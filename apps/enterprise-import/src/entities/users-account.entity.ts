import { Column, Entity, PrimaryColumn } from 'typeorm';

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
}
