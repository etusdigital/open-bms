import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

export type WhatsappChannelMode = 'meta' | 'evohub';
export type WhatsappChannelStatus = 'pending' | 'active' | 'disconnected' | 'error';

@Entity('whatsapp_channels')
@Unique('whatsapp_channels_phone_unique', ['accountId', 'phoneNumberId'])
@Index('idx_whatsapp_channels_account', ['accountId'])
@Index('idx_whatsapp_channels_status', ['status'])
@Index('idx_whatsapp_channels_mode', ['mode'])
export class WhatsappChannel {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'account_id', type: 'integer' })
  accountId: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  mode: WhatsappChannelMode;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
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
