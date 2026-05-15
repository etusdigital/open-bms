import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('messages')
export class MessageEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'title', length: 255 })
  title: string;

  @Column('varchar', { name: 'ippool', length: 255 })
  ippool: string;

  @Column('varchar', { name: 'priority', length: 20 })
  priority: string;

  @Column('varchar', { name: 'subject', length: 255 })
  subject: string;

  @Column('varchar', { name: 'preview_text', length: 255 })
  previewText: string;

  @Column('varchar', { name: 'from_mail', length: 255 })
  fromMail: string;

  @Column('varchar', { name: 'from_name', length: 255 })
  fromName: string;

  @Column('varchar', { name: 'bucket_name', length: 255 })
  bucketName: string;

  @Column('text', { name: 'file_name' })
  fileName: string;

  @Column('text', { name: 'reply_to' })
  replyTo: string;

  @Column('text', { name: 'content' })
  content: string;

  @Column('varchar', { name: 'url', length: 500 })
  url: string;

  @Column('varchar', { name: 'type', length: 255 })
  type: string;

  @Column('int', { name: 'expiry_push_in_seconds' })
  expiryPushInSeconds: number;

  @Column('varchar', { name: 'status', length: 20 })
  status: string;

  @Column('varchar', { name: 'whatsapp_type', length: 50 })
  whatsappType: string;

  @Column('varchar', { name: 'call_to_action_text', length: 100 })
  callToActionText: string;

  @Column('varchar', { name: 'provider_message_id', length: 100 })
  providerMessageId: string;
}
