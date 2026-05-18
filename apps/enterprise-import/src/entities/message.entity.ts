import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('messages')
@Unique(['accountId', 'name'])
export class MessageEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'title', length: 255 })
  title: string;

  @Column('varchar', { name: 'name', length: 40 })
  name: string;

  @Column('text', { name: 'description' })
  description?: string;

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

  @Column('varchar', { name: 'image', length: 500 })
  image: string;

  @Column('varchar', { name: 'url', length: 500 })
  url: string;

  @Column('int', { name: 'expiry_push_in_seconds' })
  expiryPushInSeconds: number;

  @Column('varchar', { name: 'expiry_push_filter', length: 20 })
  expiryPushFilter: string;

  @Column('varchar', { name: 'notification_sound', length: 20 })
  notificationSound: string;

  @Column('varchar', { name: 'status', length: 20 })
  status: string;

  @Column('varchar', { name: 'whatsapp_type', length: 50 })
  whatsappType: string;

  @Column('varchar', { name: 'call_to_action_text', length: 100 })
  callToActionText: string;

  @Column('varchar', { name: 'provider_message_id', length: 100 })
  providerMessageId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;
}
