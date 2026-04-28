import { BeforeUpdate, Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('pools')
export class PoolEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'name', length: 255 })
  name: string;

  @Column('text', { name: 'description' })
  description?: string;

  @Column('varchar', { name: 'pool_name', length: 255 })
  poolName: string;

  @Column('json', { name: 'ip' })
  ip: any;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('int', { name: 'sending_limit' })
  sendingLimit: number;

  @Column('varchar', { name: 'sender_email', length: 255 })
  senderEmail: string;

  @Column('varchar', { name: 'sender_name', length: 60 })
  senderName: string;

  @Column('varchar', { name: 'sender_replyto_email', length: 255 })
  senderReplyTo: string;

  @Column('boolean', { name: 'is_default', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @BeforeUpdate()
  callbeforeupdate() {
    this.updatedAt = new Date();
  }
}
