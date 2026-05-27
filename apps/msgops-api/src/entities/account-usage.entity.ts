import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('accounts_usages')
export class AccountUsageEntity {
  @PrimaryColumn({ type: 'int', name: 'account_id' })
  accountId: number;

  @PrimaryColumn('varchar', { name: 'service', length: 255 })
  service: string;

  @PrimaryColumn('date', { name: 'date' })
  date: Date;

  @Column('int', { name: 'count' })
  count: number;
}
