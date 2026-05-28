import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { EvolutionHubClient } from '@bms/evolution-hub';
import { EXCHANGES } from '@bms/messaging';
import { RedisService } from '../../providers/redis.provider';
import { EventPublisherService } from '../../providers/messaging/event-publisher.service';
import { WhatsappChannelEntity } from '../../entities/whatsapp-channel.entity';
import { MessageEntity } from '../../entities/message.entity';
import { ContactEntity } from '../../entities/contact.entity';
import { WhatsappMessageSendEntity } from '../../entities/whatsapp-message-send.entity';
import { WhatsappInboundMessageEntity } from '../../entities/whatsapp-inbound-message.entity';

const DEDUP_TTL_SECONDS = 300; // 5 min — matches CRM evolution_hub_events_job.

// Status-level dedup must outlast the body-level dedup: Meta can deliver
// `delivered` and `read` for the same wamid hours apart in separate batches.
const STATUS_DEDUP_TTL_SECONDS = 60 * 60 * 24; // 24h

// Meta error codes that mean the number definitively does not receive WhatsApp.
// Conservative — only 131026 flips has_whatsapp in this phase; expand once we
// observe other codes' volume in production.
// Ref: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/
const TERMINAL_HAS_WHATSAPP_CODES = new Set<number>([131026]);

/** Internal verbs we publish to event-process; mirrors EventsType taxonomy. */
type WhatsappAnalyticsEvent = 'sent' | 'delivered' | 'read' | 'failed' | 'inbound';

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
    @InjectRepository(MessageEntity) private readonly messages: Repository<MessageEntity>,
    @InjectRepository(ContactEntity) private readonly contacts: Repository<ContactEntity>,
    @InjectRepository(WhatsappMessageSendEntity) private readonly sends: Repository<WhatsappMessageSendEntity>,
    @InjectRepository(WhatsappInboundMessageEntity) private readonly inbound: Repository<WhatsappInboundMessageEntity>,
    private readonly redis: RedisService,
    private readonly eventPublisher: EventPublisherService,
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

  /**
   * Releases the body-level dedup key set by isDuplicate() (F1). The controller
   * calls isDuplicate() (a SETNX) BEFORE processing, so if processing then
   * throws (e.g. a Postgres write failed → 5xx → Meta retry), the byte-identical
   * retry would hit the still-set dedup key and be skipped — the event would be
   * lost. Releasing the key on the failure path lets the retry reprocess, while
   * the key stays set on success (retry-storm protection preserved).
   */
  async releaseDedupKey(source: 'meta' | 'evohub', deliveryKey: string): Promise<void> {
    const key = `wa:webhook:${source}:${deliveryKey}`;
    try {
      await this.redis.getClient().del(key);
    } catch (err: any) {
      this.logger.warn(`redis_dedup_release_failed key=${key} err=${err?.message ?? 'unknown'}`);
    }
  }

  buildMetaDeliveryKey(rawBody: Buffer | string): string {
    const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    return createHash('sha1').update(buf).digest('hex');
  }

  /**
   * Meta webhook: object='whatsapp_business_account', entry[].changes carry
   * `messages.statuses` (delivered/read/failed) and `messages.messages`
   * (inbound replies from contacts), plus template approvals.
   *
   * Routing:
   *   - field 'message_template_status_update' → applyTemplateStatusUpdate (wave 6)
   *   - field 'messages' → statuses[] (delivery lifecycle) + messages[] (inbound)
   *
   * We always return without throwing for technically-processed events so the
   * controller returns 200 OK and Meta does not retry-storm us.
   */
  async processMetaEvent(body: any): Promise<void> {
    this.logger.log(`meta_webhook_event object=${body?.object ?? 'unknown'} entries=${(body?.entry ?? []).length}`);

    const entries: any[] = Array.isArray(body?.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        // Log any error block first — `field === 'messages'` carrying top-level
        // errors used to `continue` past the trailing error-log branch (F12),
        // so messages-field error payloads were never logged. Hoist it here so
        // it fires for every field (messages, template, quality, ...).
        if (change?.value?.errors?.length) {
          this.logger.warn(`meta_webhook_error_event entry=${entry?.id ?? '?'} field=${change?.field ?? '?'} errors=${JSON.stringify(change.value.errors).slice(0, 200)}`);
        }
        if (change?.field === 'message_template_status_update') {
          await this.applyTemplateStatusUpdate(change.value);
          continue;
        }
        if (change?.field === 'messages') {
          const value = change.value ?? {};
          const metadata = value.metadata;
          const statuses: any[] = Array.isArray(value.statuses) ? value.statuses : [];
          for (const status of statuses) {
            await this.applyStatusEvent(status, metadata);
          }
          const inbound: any[] = Array.isArray(value.messages) ? value.messages : [];
          for (const msg of inbound) {
            await this.applyInboundMessage(msg, metadata);
          }
          continue;
        }
        if (change?.field === 'phone_number_quality_update' || change?.field === 'account_review_update') {
          // Future-friendly hook; nothing to do yet.
          continue;
        }
      }
    }
  }

  /**
   * Delivery lifecycle: statuses[] = { id (wamid), status, timestamp,
   * recipient_id, errors? }. We (1) dedup per (wamid,status), (2) lookup the
   * originating send, (3) update Postgres state (send row + contact), then
   * (4) publish an analytics event to event-process.
   *
   * Decision 5 — Postgres FIRST, RabbitMQ publish AFTER (fire-and-forget):
   * if PG fails we throw → 5xx → Meta retry. If the publish fails after PG
   * committed we log+swallow → 200 OK; ClickHouse loses one analytics row
   * (acceptable) but the UI still reads delivered_at/etc. straight from
   * whatsapp_message_sends.
   *
   * Dedup ordering (F1): the per-(wamid,status) Redis key is COMMITTED only
   * AFTER the Postgres writes succeed — never before. If PG throws, the key is
   * never set, so the Meta retry re-runs the writes (PG itself is idempotent:
   * timestamps just get rewritten to NOW()). Setting the key before the write
   * would turn a PG failure into permanent event loss (retry hits the dedup
   * key and no-ops). We only READ the key up-front (cheap fast-path) to skip
   * legitimate duplicate deliveries.
   *
   * Unknown-wamid (F2): the wamid→send row is persisted asynchronously via
   * RabbitMQ (1-2s lag), so a fast `delivered` can arrive before the row lands.
   * We DELIBERATELY do not set the dedup key on that path — a Meta retry after
   * the row exists then reconciles delivered_at/read_at onto the send row. The
   * enriched ClickHouse event for that retry is dropped by event-process's own
   * idempotency (same wamid+event), which is the accepted CH-loss per Decisão 5.
   */
  async applyStatusEvent(status: any, metadata: any): Promise<void> {
    const wamid: string | undefined = status?.id;
    const verb: string | undefined = status?.status;
    if (!wamid || !verb) {
      this.logger.warn(`wa_status_incomplete wamid=${wamid ?? '?'} status=${verb ?? '?'}`);
      return;
    }

    const dedupKey = `wa:webhook:status:${wamid}:${verb}`;
    if (await this.isStatusKeySet(dedupKey)) {
      this.logger.log(`wa_status_dedup_hit wamid=${wamid} status=${verb}`);
      return;
    }

    const send = await this.sends.findOne({ where: { wamid } });

    // Unknown wamid (e.g. number used outside BMS too, or send row not yet
    // persisted — F2): never error. Resolve the account from metadata so
    // analytics still gets the event, but with no contact/campaign correlation,
    // and skip contact updates. Do NOT set the dedup key so a Meta retry after
    // the send row lands can reconcile delivered_at/read_at onto it.
    if (!send) {
      const accountId = await this.resolveAccountId(metadata);
      this.logger.warn(`wa_status_unknown_wamid wamid=${wamid} status=${verb} account=${accountId ?? '?'}`);
      const mapped = this.mapStatusToEvent(verb);
      if (mapped && accountId) {
        await this.publishWhatsappEvent({
          event: mapped,
          wamid,
          accountId,
          timestamp: this.toEpochMs(status?.timestamp, wamid),
          properties: { wamid, recipient_id: status?.recipient_id },
        });
      }
      return;
    }

    const errors: any[] = Array.isArray(status?.errors) ? status.errors : [];
    const firstError = errors[0];

    // ── Postgres writes first. If any of these throw, we propagate (→ 5xx →
    // Meta retry) WITHOUT having set the dedup key, so the retry reprocesses.
    // contactId can be null after a contact deletion (ON DELETE SET NULL, F3):
    // we still record delivery state on the send row, but skip contact-side
    // mirrors when there is no contact to update.
    const contactId = send.contactId;
    switch (verb) {
      case 'sent':
        // sent_at already set at send time; just mirror to the contact.
        if (contactId != null) await this.updateContactWhatsappTimestamp(contactId, 'whatsappLastSent');
        break;
      case 'delivered':
        await this.sends
          .createQueryBuilder()
          .update()
          .set({ deliveredAt: () => 'NOW()' })
          .where('wamid = :wamid', { wamid })
          .execute();
        if (contactId != null) await this.updateContactWhatsappTimestamp(contactId, 'whatsappLastDelivered');
        break;
      case 'read':
        await this.sends
          .createQueryBuilder()
          .update()
          .set({ readAt: () => 'NOW()' })
          .where('wamid = :wamid', { wamid })
          .execute();
        if (contactId != null) await this.updateContactWhatsappTimestamp(contactId, 'whatsappLastOpen');
        break;
      case 'failed':
        await this.sends
          .createQueryBuilder()
          .update()
          .set({ failedAt: () => 'NOW()', failureCode: firstError?.code ?? null, failureTitle: this.coerceFailureTitle(firstError) })
          .where('wamid = :wamid', { wamid })
          .execute();
        if (contactId != null && firstError?.code !== undefined && TERMINAL_HAS_WHATSAPP_CODES.has(Number(firstError.code))) {
          // Bypass @BeforeUpdate setUserDetails — webhooks have no requestContext.
          await this.contacts.createQueryBuilder().update().set({ hasWhatsapp: false }).where('id = :id', { id: contactId }).execute();
          this.logger.log(`wa_has_whatsapp_disabled contact=${contactId} code=${firstError.code}`);
        }
        break;
      default:
        this.logger.log(`wa_status_unhandled wamid=${wamid} status=${verb}`);
        return;
    }

    // PG committed → safe to commit the dedup key now (F1). A failure here is
    // harmless: worst case a duplicate delivery reprocesses (PG is idempotent).
    await this.setStatusKey(dedupKey);

    const mapped = this.mapStatusToEvent(verb);
    if (mapped) {
      await this.publishWhatsappEvent({
        event: mapped,
        wamid,
        accountId: send.accountId,
        contactId: send.contactId ?? undefined,
        campaignId: send.campaignId ?? undefined,
        automationId: send.automationId ?? undefined,
        messageId: send.messageId,
        utmCampaign: send.utmCampaign ?? undefined,
        timestamp: this.toEpochMs(status?.timestamp, wamid),
        errorCode: firstError?.code,
        errorTitle: firstError?.title ?? firstError?.message,
        properties: verb === 'failed' ? { error_code: firstError?.code, error_title: firstError?.title } : undefined,
      });
    }
  }

  /**
   * Inbound (contact reply): messages[] = { from, id (wamid), type, text?,
   * context?, timestamp, ... }. Persisted to whatsapp_inbound_messages even
   * when the contact is unknown (contact_id NULL). An analytics event is also
   * published so the future reply-trigger consumer has its source (decision 7).
   */
  async applyInboundMessage(msg: any, metadata: any): Promise<void> {
    const wamid: string | undefined = msg?.id;
    const from: string | undefined = msg?.from;
    if (!wamid || !from) {
      this.logger.warn(`wa_inbound_incomplete wamid=${wamid ?? '?'} from=${from ?? '?'}`);
      return;
    }

    // No Redis dedup for inbound (F7): the inbound INSERT already uses
    // UNIQUE(wamid) + .orIgnore() (ON CONFLICT DO NOTHING), which is the
    // authoritative idempotency guard against Meta retries. A redundant Redis
    // SETNX before channel resolution would also burn the key on an
    // unresolved-channel return below — dropping the message on the retry that
    // could finally resolve it. Rely solely on the DB constraint.

    const channel = await this.resolveChannel(metadata);
    if (!channel) {
      this.logger.warn(`wa_inbound_unknown_channel wamid=${wamid} phone_number_id=${metadata?.phone_number_id ?? '?'}`);
      return;
    }

    const fromNormalized = this.normalizeNumber(from);
    const contact = await this.contacts.findOne({ where: { accountId: channel.accountId, whatsapp: fromNormalized } });

    const messageType: string = msg?.type ?? 'unknown';
    const textBody = this.truncateTextBody(this.extractInboundText(msg));
    const contextWamid: string | null = msg?.context?.id ?? null;
    // Compute the epoch once so an invalid timestamp warns at most once (F4).
    const receivedAtMs = this.toEpochMs(msg?.timestamp, wamid);

    await this.inbound
      .createQueryBuilder()
      .insert()
      .into(WhatsappInboundMessageEntity)
      .values({
        wamid,
        accountId: channel.accountId,
        channelId: channel.id,
        contactId: contact?.id ?? null,
        fromNumber: fromNormalized,
        messageType,
        textBody,
        contextWamid,
        rawPayload: msg,
        receivedAt: new Date(receivedAtMs),
      })
      .orIgnore() // ON CONFLICT (wamid) DO NOTHING — idempotent vs Meta retries
      .execute();

    await this.publishWhatsappEvent({
      event: 'inbound',
      wamid,
      accountId: channel.accountId,
      contactId: contact?.id,
      timestamp: receivedAtMs,
      routingSuffix: '.inbound',
      properties: { text_body: textBody, context_wamid: contextWamid, message_type: messageType, from_number: fromNormalized },
    });
  }

  /**
   * Raw createQueryBuilder UPDATE to bypass the @BeforeUpdate setUserDetails
   * listener.
   *
   * Day granularity by design (F5): the contact `whatsapp_last_*` columns are
   * `date` (not timestamp), so NOW() truncates to the calendar day. This is
   * intentional and matches the existing Twilio/SMS `sms_last_*` convention —
   * AC2/AC3's "whatsapp_last_delivered = T" / "whatsapp_last_open = T" are
   * understood as the day of the event, not the exact instant. We do NOT change
   * the column types (out of scope, would touch the contacts table contract).
   */
  private async updateContactWhatsappTimestamp(contactId: number, field: 'whatsappLastSent' | 'whatsappLastDelivered' | 'whatsappLastOpen' | 'whatsappLastClick'): Promise<void> {
    await this.contacts
      .createQueryBuilder()
      .update()
      .set({ [field]: () => 'NOW()' })
      .where('id = :id', { id: contactId })
      .execute();
  }

  /**
   * Status-level dedup READ (F1): returns true if the (wamid,status) key is
   * already set, i.e. this exact status was processed-and-committed before.
   * Read-only — the key is committed separately via setStatusKey() only AFTER
   * the Postgres writes succeed, so a PG failure never leaves a stale key that
   * would suppress the Meta retry. On Redis failure, process anyway (return
   * false) rather than dropping the event.
   */
  private async isStatusKeySet(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.getClient().exists(key);
      return exists === 1;
    } catch (err: any) {
      this.logger.warn(`redis_status_dedup_read_failed key=${key} err=${err?.message ?? 'unknown'}`);
      return false;
    }
  }

  /**
   * Commits the status-level dedup key with a 24h TTL (F1). Called only after
   * the Postgres writes succeeded. A failure here is non-fatal: the worst case
   * is a duplicate delivery reprocessing the (idempotent) PG writes.
   */
  private async setStatusKey(key: string): Promise<void> {
    try {
      await this.redis.getClient().set(key, '1', 'EX', STATUS_DEDUP_TTL_SECONDS);
    } catch (err: any) {
      this.logger.warn(`redis_status_dedup_set_failed key=${key} err=${err?.message ?? 'unknown'}`);
    }
  }

  private mapStatusToEvent(verb: string): WhatsappAnalyticsEvent | null {
    switch (verb) {
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'read':
        return 'read';
      case 'failed':
        return 'failed';
      default:
        return null;
    }
  }

  /**
   * Publishes the analytics envelope to event-process. Fire-and-forget per
   * decision 5: a publish failure after the Postgres write must NOT bubble up
   * (it would force a Meta retry and double-write). We log and continue.
   */
  private async publishWhatsappEvent(payload: {
    event: WhatsappAnalyticsEvent;
    wamid: string;
    accountId: number;
    contactId?: number;
    campaignId?: number;
    automationId?: number;
    messageId?: number;
    utmCampaign?: string;
    timestamp: number;
    errorCode?: number;
    errorTitle?: string;
    properties?: Record<string, any>;
    routingSuffix?: string;
  }): Promise<void> {
    const routingKey = `event.received.whatsapp${payload.routingSuffix ?? ''}`;
    try {
      await this.eventPublisher.publish(EXCHANGES.events, routingKey, {
        wamid: payload.wamid,
        event: payload.event,
        accountId: payload.accountId,
        contactId: payload.contactId,
        campaignId: payload.campaignId,
        automationId: payload.automationId,
        messageId: payload.messageId,
        utmCampaign: payload.utmCampaign,
        timestamp: payload.timestamp,
        errorCode: payload.errorCode,
        errorTitle: payload.errorTitle,
        properties: payload.properties,
      });
    } catch (err: any) {
      this.logger.warn(`wa_event_publish_failed wamid=${payload.wamid} event=${payload.event} err=${err?.message ?? 'unknown'}`);
    }
  }

  /** Resolve the account_id from metadata.phone_number_id (best-effort). */
  private async resolveAccountId(metadata: any): Promise<number | null> {
    const channel = await this.resolveChannel(metadata);
    return channel?.accountId ?? null;
  }

  private async resolveChannel(metadata: any): Promise<WhatsappChannelEntity | null> {
    const phoneNumberId: string | undefined = metadata?.phone_number_id;
    if (!phoneNumberId) return null;
    return this.channels.findOne({ where: { phoneNumberId } });
  }

  /**
   * Meta timestamps are unix seconds (string); normalize to ms. On an
   * invalid/missing timestamp we fall back to Date.now() so we never drop the
   * event, but we WARN first (F4) — a silent fallback corrupts timeline
   * ordering and is impossible to diagnose after the fact. The wamid is logged
   * so the offending event can be traced.
   */
  private toEpochMs(ts: any, wamid?: string): number {
    const n = Number(ts);
    if (Number.isFinite(n) && n > 0) return n * 1000;
    this.logger.warn(`wa_invalid_timestamp wamid=${wamid ?? '?'} raw=${JSON.stringify(ts)?.slice(0, 64)} — falling back to now()`);
    return Date.now();
  }

  /**
   * Coerce Meta's `errors[0].title|message` to a safe string for the
   * failure_title VARCHAR(255) column (F6). Meta input is untrusted: a
   * non-string (object/array) would yield "[object Object]" via .toString().
   * Use the string as-is when it is one, else JSON.stringify; cap at 255.
   */
  private coerceFailureTitle(firstError: any): string | null {
    const raw = firstError?.title ?? firstError?.message;
    if (raw == null) return null;
    const str = typeof raw === 'string' ? raw : JSON.stringify(raw);
    return str.slice(0, 255);
  }

  /**
   * Cap inbound text_body length on insert (F9). The column is TEXT (unbounded)
   * but an abusive/garbage payload should not bloat the row; 4000 chars is well
   * above any legitimate WhatsApp message (4096 body limit) while bounding
   * storage. Full content remains in raw_payload for forensics. Retention/purge
   * of raw_payload is a deferred follow-up — idx_wim_account_received_at already
   * supports a time-bounded purge job.
   */
  private truncateTextBody(text: string | null): string | null {
    if (text == null) return null;
    return text.length > 4000 ? text.slice(0, 4000) : text;
  }

  private normalizeNumber(raw: string): string {
    return String(raw ?? '').replace(/\D+/g, '');
  }

  private extractInboundText(msg: any): string | null {
    switch (msg?.type) {
      case 'text':
        return msg?.text?.body ?? null;
      case 'button':
        return msg?.button?.text ?? null;
      case 'interactive':
        return msg?.interactive?.button_reply?.title ?? msg?.interactive?.list_reply?.title ?? null;
      case 'reaction':
        return msg?.reaction?.emoji ?? null;
      default:
        // image/audio/video/document/location/etc. carry no plain text in this
        // phase (media download is out of scope) — keep null, raw_payload has all.
        return null;
    }
  }

  /**
   * Wave 6 — `message_template_status_update` payload:
   *   { event: 'APPROVED'|'REJECTED'|'PAUSED'|'PENDING_DELETION',
   *     message_template_id: '1234567890', message_template_name: 'order_update',
   *     message_template_language: 'pt_BR', reason?: 'TAG_CONTENT_MISMATCH' }
   *
   * We persist the new status on the BMS message that originated the template
   * (matched by providerMessageId). The send path (wave 5) reads message.status
   * to know if it's safe to dispatch.
   */
  private async applyTemplateStatusUpdate(value: any): Promise<void> {
    const templateName: string | undefined = value?.message_template_name;
    const event: string | undefined = value?.event;
    if (!templateName || !event) {
      this.logger.warn(`template_status_event_incomplete event=${event ?? '?'} name=${templateName ?? '?'}`);
      return;
    }
    const normalised = this.normaliseMetaStatus(event);
    const result = await this.messages.createQueryBuilder().update().set({ status: normalised }).where('provider_message_id = :name', { name: templateName }).execute();
    this.logger.log(`template_status_update name=${templateName} event=${event} normalised=${normalised} affected=${result.affected ?? 0}`);
  }

  /** Maps the Meta event verb to the BMS message status taxonomy. */
  private normaliseMetaStatus(event: string): string {
    switch (event.toUpperCase()) {
      case 'APPROVED':
        return 'approved';
      case 'REJECTED':
        return 'rejected';
      case 'PAUSED':
      case 'DISABLED':
      case 'PENDING_DELETION':
        return 'rejected';
      default:
        return 'pending';
    }
  }

  /**
   * EvoHub webhook: lifecycle events (channel_connected, channel_disconnected)
   * and Meta event forwards (whatsapp_business_account).
   */
  async processHubEvent(body: any): Promise<void> {
    const event = (body?.event ?? '').toString();
    // The Hub uses two payload shapes on the same endpoint:
    //   - Lifecycle events: { event: 'channel_connected', data: {...} }
    //   - Meta-forwarded events: { object: 'whatsapp_business_account', entry: [...] }
    // Identify the kind explicitly so the log is honest about what happened.
    const kind = event ? event : body?.object === 'whatsapp_business_account' ? 'meta_forward' : 'unknown';
    this.logger.log(`evohub_webhook_event kind=${kind}`);

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
      return;
    }
    this.logger.warn(`evohub_webhook_event_unrecognised body=${JSON.stringify(body).slice(0, 300)}`);
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

    // Hub's channel_connected event ONLY carries identity fields (id, name,
    // status, type, user_id, external_id). The actual Meta data
    // (phone_number_id, waba_id, display_phone_number) lives under
    // `meta_connection` in the channel resource. Fetch it now so the UI can
    // surface the connected number — otherwise the row sits as "active" with
    // the "waiting for signup" hint forever.
    const meta = await this.fetchHubChannelMeta(String(hubChannelId));

    const data = body?.data ?? body?.channel ?? {};
    row.phoneNumberId = meta.phoneNumberId ?? data.phone_number_id ?? row.phoneNumberId;
    row.wabaId = meta.wabaId ?? data.waba_id ?? row.wabaId;
    row.displayPhoneNumber = meta.displayPhoneNumber ?? data.display_phone_number ?? row.displayPhoneNumber;
    row.businessId = meta.businessId ?? row.businessId;
    row.status = 'active';
    row.lastEventAt = new Date();
    row.evolutionHubMeta = { ...(row.evolutionHubMeta ?? {}), last_connected_event: data };
    await this.channels.save(row);
  }

  /**
   * Pulls the full channel resource from the Hub so we can populate
   * phone_number_id / waba_id / display_phone_number. Best-effort — failures
   * are logged and we fall back to the (incomplete) webhook payload.
   */
  private async fetchHubChannelMeta(hubChannelId: string): Promise<{
    phoneNumberId?: string;
    wabaId?: string;
    businessId?: string;
    displayPhoneNumber?: string;
  }> {
    const apiKey = process.env.EVOLUTION_HUB_API_KEY;
    if (!apiKey) return {};
    try {
      const hub = new EvolutionHubClient({ apiKey, baseUrl: process.env.EVOLUTION_HUB_URL ?? 'https://api.evohub.ai' });
      const channel = await hub.getChannel(hubChannelId);
      const mc = channel.meta_connection;
      if (!mc) return {};
      const phone = mc.phone_numbers?.[0];
      return {
        phoneNumberId: mc.phone_number_id,
        wabaId: mc.waba_id,
        businessId: mc.business_id,
        displayPhoneNumber: phone?.display_phone_number,
      };
    } catch (err: any) {
      this.logger.warn(`hub_fetch_channel_meta_failed id=${hubChannelId} err=${err?.message ?? 'unknown'}`);
      return {};
    }
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
