import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Maps a Meta `wamid` to the BMS send that produced it. Written (UPSERT) by
 * the `whatsapp.sent.persist` consumer when send-whatsapp dispatches a
 * template; read by the delivery webhook to correlate `statuses[].id`.
 *
 * Relations are intentionally NOT declared as @ManyToOne — the webhook path
 * only needs the raw foreign-key ids for fast lookup + raw UPDATEs, and lazy
 * relations would add join overhead on the hot path. FKs are enforced at the
 * DB level (see migration 1781400000000).
 */
@Entity('whatsapp_message_sends')
@Index('idx_wms_contact', ['contactId'])
export class WhatsappMessageSendEntity {
  @PrimaryColumn({ name: 'wamid', type: 'varchar', length: 128 })
  wamid: string;

  @Column({ name: 'account_id', type: 'integer' })
  accountId: number;

  @Column({ name: 'channel_id', type: 'integer' })
  channelId: number;

  // Nullable + ON DELETE SET NULL (F3): deleting a contact must NOT erase the
  // send history (first rule of the project: never lose data). The webhook
  // guards against a null contactId before touching contact-side state.
  @Column({ name: 'contact_id', type: 'integer', nullable: true })
  contactId: number | null;

  @Column({ name: 'message_id', type: 'integer' })
  messageId: number;

  @Column({ name: 'campaign_id', type: 'integer', nullable: true })
  campaignId: number | null;

  @Column({ name: 'automation_id', type: 'integer', nullable: true })
  automationId: number | null;

  @Column({ name: 'utm_campaign', type: 'varchar', length: 255, nullable: true })
  utmCampaign: string | null;

  @Column({ name: 'template_name', type: 'varchar', length: 255, nullable: true })
  templateName: string | null;

  @Column({ name: 'to_number', type: 'varchar', length: 32, nullable: true })
  toNumber: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', default: () => 'NOW()' })
  sentAt: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt: Date | null;

  @Column({ name: 'failure_code', type: 'integer', nullable: true })
  failureCode: number | null;

  @Column({ name: 'failure_title', type: 'varchar', length: 255, nullable: true })
  failureTitle: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
