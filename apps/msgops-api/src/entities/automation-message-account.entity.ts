import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { MessageEntity } from './message.entity';

@Entity('automation_message_account')
export class AutomationMessageAccountEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({
    type: 'varchar',
    nullable: false,
    name: 'test_id',
    length: 255,
  })
  testId: string;

  @Column({
    type: 'varchar',
    nullable: false,
    name: 'provider_account_id',
    length: 255,
  })
  providerAccountId: string;

  @Column({ type: 'varchar', name: 'provider', length: 20 })
  provider?: string;

  @ManyToOne(() => MessageEntity, (messages) => messages.automationMessageAccount, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'automation_message_id', referencedColumnName: 'id' }])
  message: MessageEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;
}
