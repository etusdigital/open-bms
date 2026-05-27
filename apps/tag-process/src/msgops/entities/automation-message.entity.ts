import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('automations_message')
export class AutomationMessageEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'title', length: 255 })
  title: string;

  @Column('varchar', { name: 'name', length: 255 })
  name: string;

  @Column('varchar', { name: 'ippool', length: 255 })
  ippool?: string;

  @Column('varchar', { name: 'priority', length: 20 })
  priority?: string;

  @Column('varchar', { name: 'type', length: 255 })
  type?: string;

  @Column('varchar', { name: 'subject', length: 255 })
  subject: string;

  @Column('varchar', { name: 'preview_text', length: 255 })
  previewText?: string;

  @Column('text', { name: 'content' })
  content: string;

  @Column('text', { name: 'text' })
  text: string;

  @Column('varchar', { name: 'from_mail', length: 255 })
  fromMail: string;

  @Column('varchar', { name: 'from_name', length: 255 })
  fromName: string;

  @Column('bool', { name: 'is_tested' })
  isTested: boolean;

  @Column('int', { name: 'message_id' })
  messageId?: number;

  @Column('int', { name: 'version' })
  version: number;

  @Column('varchar', { name: 'template_url', length: 255 })
  templateUrl: string;

  @Column('varchar', { name: 'bucket_name', length: 255 })
  bucketName: string;

  @Column('text', { name: 'file_name' })
  fileName: string;

  @Column('json', { name: 'content_json' })
  content_json: string;

  @Column('text', { name: 'reply_to' })
  replyTo: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;
}
