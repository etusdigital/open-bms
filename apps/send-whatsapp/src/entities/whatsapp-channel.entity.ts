import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type WhatsappChannelMode = 'meta' | 'evohub';
export type WhatsappChannelStatus = 'pending' | 'active' | 'disconnected' | 'error';

/**
 * Wave 5 — local mirror of the msgops-api WhatsappChannelEntity.
 *
 * send-whatsapp does NOT own this table; msgops-api does. We re-declare the
 * entity here because TypeORM scans `apps/send-whatsapp/src/entities/*.ts`
 * for the connection and we need to query the row to resolve the channel
 * config (mode, baseUrl, bearerToken, phoneNumberId) before each send.
 * Keep this shape in sync with apps/msgops-api/src/entities/whatsapp-channel.entity.ts.
 */
@Entity('whatsapp_channels')
export class WhatsappChannelEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'account_id', type: 'integer' })
  accountId: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  mode: WhatsappChannelMode;

  @Column({ type: 'varchar', length: 32 })
  status: WhatsappChannelStatus;

  @Column({ name: 'waba_id', type: 'varchar', length: 64, nullable: true })
  wabaId: string | null;

  @Column({ name: 'phone_number_id', type: 'varchar', length: 64, nullable: true })
  phoneNumberId: string | null;

  @Column({ name: 'display_phone_number', type: 'varchar', length: 32, nullable: true })
  displayPhoneNumber: string | null;

  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken: string | null;

  @Column({ name: 'business_id', type: 'varchar', length: 64, nullable: true })
  businessId: string | null;

  @Column({ name: 'hub_channel_id', type: 'varchar', length: 64, nullable: true })
  hubChannelId: string | null;

  @Column({ name: 'channel_token', type: 'text', nullable: true })
  channelToken: string | null;

  @Column({ name: 'evolution_hub_meta', type: 'jsonb', nullable: true })
  evolutionHubMeta: Record<string, unknown> | null;

  @Column({ name: 'last_event_at', type: 'timestamptz', nullable: true })
  lastEventAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
