import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AmqpConsumer, EXCHANGES } from '@bms/messaging';
import { WhatsappMessageSendEntity } from '../../entities/whatsapp-message-send.entity';

const QUEUE = 'msgops.whatsapp.sent.persist';
const ROUTING_KEY = 'whatsapp.sent.persist';
const SHUTDOWN_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

interface WhatsappSendMessage {
  wamid: string;
  accountId: number;
  channelId: number;
  contactId: number;
  messageId: number;
  campaignId?: number;
  automationId?: number;
  templateName?: string;
  toNumber?: string;
  utmCampaign?: string;
  sentAt?: string;
}

/**
 * In-process RabbitMQ consumer that persists the wamid→send mapping published
 * by send-whatsapp (`whatsapp.sent.persist`) into whatsapp_message_sends.
 *
 * We use the lightweight in-process AmqpConsumer (no HTTP bridge) because
 * msgops-api already has direct Postgres access — the HTTP-bridge indirection
 * is an event-process-local choice, not a house style. The consumer boots on
 * application bootstrap (after Nest wiring is complete) and is torn down on
 * module destroy.
 *
 * Idempotent: the INSERT uses ON CONFLICT (wamid) DO NOTHING, so Meta-style
 * retries / duplicate publishes never double-write.
 */
@Injectable()
export class WhatsappSendPersisterService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappSendPersisterService.name);
  private consumer: AmqpConsumer | null = null;

  constructor(@InjectRepository(WhatsappMessageSendEntity) private readonly sends: Repository<WhatsappMessageSendEntity>) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!process.env.AMQP_URL) {
      // No broker configured. The webhook still works against any rows that
      // exist; missing rows fall into the AC10 "unknown wamid" path rather than
      // crashing boot (early return, no throw). But in production this is a
      // misconfiguration that silently breaks wamid→send correlation, so log it
      // at ERROR to make the degraded state obvious (F8). In dev/test stacks
      // (no AMQP intentionally) keep it at warn.
      const msg = 'whatsapp_send_persister_disabled reason=no_amqp_url — wamid→send mapping will NOT be persisted';
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(msg);
      } else {
        this.logger.warn(msg);
      }
      return;
    }
    this.consumer = new AmqpConsumer({ url: process.env.AMQP_URL }, SHUTDOWN_TIMEOUT_MS);
    await this.consumer.consume<WhatsappSendMessage>({ exchange: EXCHANGES.events, routingKey: ROUTING_KEY, queue: QUEUE, maxRetries: MAX_RETRIES }, async (payload) => {
      await this.persist(payload);
    });
    this.logger.log(`whatsapp_send_persister_started queue=${QUEUE} rk=${ROUTING_KEY}`);
  }

  async persist(payload: WhatsappSendMessage): Promise<void> {
    if (!payload?.wamid) {
      this.logger.warn('whatsapp_send_persist_missing_wamid');
      return;
    }
    await this.sends
      .createQueryBuilder()
      .insert()
      .into(WhatsappMessageSendEntity)
      .values({
        wamid: payload.wamid,
        accountId: payload.accountId,
        channelId: payload.channelId,
        contactId: payload.contactId,
        messageId: payload.messageId,
        campaignId: payload.campaignId ?? null,
        automationId: payload.automationId ?? null,
        templateName: payload.templateName ?? null,
        // Normalize to E.164-without-+ to match the inbound from_number
        // normalization in WhatsappWebhooksService.normalizeNumber (F11) so
        // future to_number↔from_number joins line up. Inlined (different
        // service) rather than sharing the private helper.
        toNumber: payload.toNumber != null ? payload.toNumber.replace(/\D+/g, '') : null,
        utmCampaign: payload.utmCampaign ?? null,
        sentAt: payload.sentAt ? new Date(payload.sentAt) : new Date(),
      })
      .orIgnore() // ON CONFLICT (wamid) DO NOTHING
      .execute();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.consumer) {
      await this.consumer.shutdown().catch((err) => this.logger.error(`whatsapp_send_persister_stop_failed err=${err?.message ?? err}`));
      this.consumer = null;
    }
  }
}
