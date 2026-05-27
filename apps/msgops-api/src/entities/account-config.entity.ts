import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { AccountEntity } from './account.entity';

@Entity('accounts_configs')
@Unique(['accountId', 'name'])
export class AccountConfigEntity {
  @PrimaryColumn('int', { name: 'account_id' })
  accountId: number;

  @PrimaryColumn('varchar', { name: 'name', length: 255 })
  name: string;

  @Column('text', { name: 'description' })
  description?: string;

  @Column('text', { name: 'value' })
  value: string;

  @Column('boolean', { name: 'is_load_config' })
  isLoadConfig: boolean;

  @ManyToOne(() => AccountEntity, (account) => account.accountConfigs)
  @JoinColumn([{ name: 'account_id', referencedColumnName: 'id' }])
  account: AccountEntity;
}
