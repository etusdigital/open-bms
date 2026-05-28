import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Persists inbound WhatsApp messages (contact replies). `contact_id` is
 * nullable: Meta can deliver an inbound from a number that does not yet exist
 * in the base — we still keep `from_number` + `raw_payload` so a future job
 * can resolve it (first rule: never lose data).
 *
 * This phase only stores the event; the reply-trigger automation is out of
 * scope (see tech-spec decision 7) but the row + the published
 * `event.received.whatsapp.inbound` event prepare the terrain for it.
 */
@Entity('whatsapp_inbound_messages')
@Index('idx_wim_contact', ['contactId'])
export class WhatsappInboundMessageEntity {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: string;

  @Column({ name: 'wamid', type: 'varchar', length: 128, unique: true })
  wamid: string;

  @Column({ name: 'account_id', type: 'integer' })
  accountId: number;

  @Column({ name: 'channel_id', type: 'integer' })
  channelId: number;

  @Column({ name: 'contact_id', type: 'integer', nullable: true })
  contactId: number | null;

  @Column({ name: 'from_number', type: 'varchar', length: 32 })
  fromNumber: string;

  @Column({ name: 'message_type', type: 'varchar', length: 32 })
  messageType: string;

  @Column({ name: 'text_body', type: 'text', nullable: true })
  textBody: string | null;

  @Column({ name: 'context_wamid', type: 'varchar', length: 128, nullable: true })
  contextWamid: string | null;

  @Column({ name: 'raw_payload', type: 'jsonb' })
  rawPayload: any;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
