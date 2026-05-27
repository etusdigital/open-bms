import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { RedisService } from '../../providers/redis.provider';
import { WhatsappChannelEntity } from '../../entities/whatsapp-channel.entity';

const DEDUP_TTL_SECONDS = 300; // 5 min — matches CRM evolution_hub_events_job.

/**
 * Wave 4 — webhook event handler.
 *
 * Decoupled from the HTTP controllers so the same logic can be re-used by
 * the BullMQ worker (also wave 4) once we move processing off the request
 * thread. For wave-4 minimum-viable we run inline: validate → dedup → apply.
 */
@Injectable()
export class WhatsappWebhooksService {
  private readonly logger = new Logger(WhatsappWebhooksService.name);

  constructor(
    @InjectRepository(WhatsappChannelEntity) private readonly channels: Repository<WhatsappChannelEntity>,
    private readonly redis: RedisService,
  ) {}

  /**
   * Returns true if this delivery was already processed in the last 5 minutes.
   * Implements AC4 (dedup). Uses SETNX on a Redis key derived from the source
   * + delivery id (or body hash for Meta when no header is available).
   */
  async isDuplicate(source: 'meta' | 'evohub', deliveryKey: string): Promise<boolean> {
    const key = `wa:webhook:${source}:${deliveryKey}`;
    try {
      const result = await this.redis.getClient().set(key, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
      // SET ... NX returns null when the key already exists.
      return result === null;
    } catch (err: any) {
      this.logger.warn(`redis_dedup_failed key=${key} err=${err?.message ?? 'unknown'}`);
      // Redis down: process the event rather than dropping silently.
      return false;
    }
  }

  buildMetaDeliveryKey(rawBody: Buffer | string): string {
    const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    return createHash('sha1').update(buf).digest('hex');
  }

  /**
   * Meta webhook: object='whatsapp_business_account', entry[].changes carry
   * `messages.statuses` (delivered/read/failed) and template approvals.
   *
   * For wave 4 we ack and log — the message status update lands in wave 5 when
   * the sender (and `messages.providerMessageId`) are in place; template
   * approval lands in wave 6.
   */
  async processMetaEvent(body: any): Promise<void> {
    this.logger.log(`meta_webhook_event object=${body?.object ?? 'unknown'} entries=${(body?.entry ?? []).length}`);

    // Channel lifecycle for Meta direct is handled synchronously at create
    // time (FB.login returns the IDs). The only thing that can flip a channel
    // to 'disconnected' here is a webhook saying the access_token was
    // revoked — we surface that explicitly so the UI can prompt reconnect.
    const entries: any[] = Array.isArray(body?.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change?.field === 'phone_number_quality_update' || change?.field === 'account_review_update') {
          // Future-friendly hook; nothing to do yet.
          continue;
        }
        if (change?.value?.errors?.length) {
          this.logger.warn(`meta_webhook_error_event entry=${entry?.id ?? '?'} errors=${JSON.stringify(change.value.errors).slice(0, 200)}`);
        }
      }
    }
  }

  /**
   * EvoHub webhook: lifecycle events (channel_connected, channel_disconnected)
   * and Meta event forwards (whatsapp_business_account).
   */
  async processHubEvent(body: any): Promise<void> {
    const event = (body?.event ?? '').toString();
    this.logger.log(`evohub_webhook_event event=${event || 'unknown'}`);

    if (event === 'channel_connected') {
      await this.applyHubChannelConnected(body);
      return;
    }
    if (event === 'channel_disconnected') {
      await this.applyHubChannelDisconnected(body);
      return;
    }
    if (body?.object === 'whatsapp_business_account') {
      // Forwarded Meta event — same handling as direct mode.
      await this.processMetaEvent(body);
    }
  }

  private async applyHubChannelConnected(body: any): Promise<void> {
    const hubChannelId = body?.data?.id ?? body?.channel?.id;
    if (!hubChannelId) {
      this.logger.warn('hub_channel_connected_missing_id');
      return;
    }
    const row = await this.channels.findOne({ where: { hubChannelId: String(hubChannelId) } });
    if (!row) {
      this.logger.warn(`hub_channel_connected_unknown id=${hubChannelId}`);
      return;
    }
    const data = body?.data ?? body?.channel ?? {};
    row.phoneNumberId = data.phone_number_id ?? row.phoneNumberId;
    row.wabaId = data.waba_id ?? row.wabaId;
    row.displayPhoneNumber = data.display_phone_number ?? row.displayPhoneNumber;
    row.status = 'active';
    row.lastEventAt = new Date();
    row.evolutionHubMeta = { ...(row.evolutionHubMeta ?? {}), last_connected_event: data };
    await this.channels.save(row);
  }

  private async applyHubChannelDisconnected(body: any): Promise<void> {
    const hubChannelId = body?.data?.id ?? body?.channel?.id;
    if (!hubChannelId) return;
    const row = await this.channels.findOne({ where: { hubChannelId: String(hubChannelId) } });
    if (!row) return;
    row.status = 'disconnected';
    row.lastEventAt = new Date();
    await this.channels.save(row);
  }
}
