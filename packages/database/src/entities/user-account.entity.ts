import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Account } from './account.entity';
import { User } from './user.entity';

@Entity('users_accounts')
export class UserAccount {
  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId: number;

  @PrimaryColumn({ name: 'account_id', type: 'integer' })
  accountId: number;

  @PrimaryColumn({ name: 'is_master_user', type: 'boolean', default: false })
  isMasterUser: boolean;

  @ManyToOne(() => Account, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
