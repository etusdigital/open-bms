import { Column, Entity, PrimaryColumn, Unique } from 'typeorm';

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
}
