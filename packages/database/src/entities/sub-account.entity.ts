import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { SoftDeleteEntity } from './base.entity';
import { Sender } from './sender.entity';

@Entity('sub_accounts')
export class SubAccount extends SoftDeleteEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id', type: 'integer' })
  accountId: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @Column({ name: 'sendgrid_username', type: 'varchar', length: 255, unique: true })
  sendgridUsername: string;

  @Column({ name: 'sendgrid_api_key', type: 'text', nullable: true })
  sendgridApiKey: string | null;

  @OneToMany(() => Sender, (sender) => sender.subAccount, { cascade: false })
  senders: Sender[];
}
