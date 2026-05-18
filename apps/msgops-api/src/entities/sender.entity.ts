import { BeforeUpdate, Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('senders')
export class SenderEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'sender_email', length: 255 })
  senderEmail: string;

  @Column('varchar', { name: 'sender_name', length: 60 })
  senderName: string;

  @Column('varchar', { name: 'sender_replyto_email', length: 255, nullable: true })
  senderReplyTo: string;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('boolean', { name: 'is_default', default: false })
  isDefault: boolean;

  @Column('varchar', { name: 'sg_verified_sender_id', length: 255, nullable: true })
  sgVerifiedSenderId: string;

  @Column('timestamptz', { name: 'removed_at_source', nullable: true })
  removedAtSource: Date;

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
