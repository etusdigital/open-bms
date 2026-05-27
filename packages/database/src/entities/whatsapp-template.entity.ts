import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

export type WhatsappTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type WhatsappTemplateMetaStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED';

export interface WhatsappTemplateMeta {
  header?: {
    format?: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    example?: string;
  };
  body?: {
    text?: string;
    examples?: string[];
  };
  footer?: {
    text?: string;
  };
  buttons?: Array<
    | { type: 'QUICK_REPLY'; text: string }
    | { type: 'URL'; text: string; url: string; example?: string[] }
    | { type: 'PHONE_NUMBER'; text: string; phone_number: string }
  >;
  var_map?: Record<string, string>;
}

@Entity('whatsapp_templates')
@Unique('whatsapp_templates_slug_locale_unique', ['channelId', 'slug', 'locale'])
@Index('idx_whatsapp_templates_account', ['accountId'])
@Index('idx_whatsapp_templates_status', ['metaStatus'])
export class WhatsappTemplate {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'account_id', type: 'integer' })
  accountId: number;

  @Column({ name: 'channel_id', type: 'integer' })
  channelId: number;

  @Column({ type: 'varchar', length: 128 })
  slug: string;

  @Column({ type: 'varchar', length: 16, default: 'pt_BR' })
  locale: string;

  @Column({ type: 'varchar', length: 32 })
  category: WhatsappTemplateCategory;

  @Column({ name: 'body_text', type: 'text' })
  bodyText: string;

  @Column({ type: 'jsonb' })
  meta: WhatsappTemplateMeta;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  placeholders: string[];

  @Column({ name: 'meta_template_id', type: 'varchar', length: 64, nullable: true })
  metaTemplateId: string | null;

  @Column({ name: 'meta_status', type: 'varchar', length: 32, nullable: true })
  metaStatus: WhatsappTemplateMetaStatus | null;

  @Column({ name: 'meta_rejected_reason', type: 'text', nullable: true })
  metaRejectedReason: string | null;

  @Column({ name: 'meta_synced_at', type: 'timestamptz', nullable: true })
  metaSyncedAt: Date | null;

  @Column({ name: 'updated_by', type: 'integer', nullable: true })
  updatedBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
