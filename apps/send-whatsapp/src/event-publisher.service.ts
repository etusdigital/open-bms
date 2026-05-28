import { Injectable } from '@nestjs/common';
import { AmqpPublisher, EXCHANGES, type ExchangeName } from '@bms/messaging';

export interface WhatsappSendPayload {
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
  sentAt: string;
}

@Injectable()
export class EventPublisherService {
  private readonly publisher: AmqpPublisher;

  constructor() {
    if (!process.env.AMQP_URL) {
      throw new Error('AMQP_URL environment variable is required');
    }
    this.publisher = new AmqpPublisher({ url: process.env.AMQP_URL });
  }

  async publish(exchange: ExchangeName, routingKey: string, payload: Record<string, any>, customAttributes: Record<string, any> = {}): Promise<void> {
    const headers: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(customAttributes)) {
      if (typeof value === 'string' || typeof value === 'number') {
        headers[key] = value;
      } else if (typeof value === 'boolean') {
        headers[key] = value ? 'true' : 'false';
      } else {
        console.warn('[EventPublisher] dropping unsupported header type:', key, typeof value);
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[EventPublisher] publishing', { exchange, routingKey });
    }

    await this.publisher.publish({
      exchange,
      routingKey,
      payload,
      headers,
    });
  }

  /**
   * Publishes the wamid→send mapping so msgops-api can persist it into
   * whatsapp_message_sends (consumed by WhatsappSendPersisterService). Pub/sub
   * keeps the services decoupled — send-whatsapp has no access to the msgops
   * Postgres. Accepts a 1-2s delay before the first row appears (tradeoff vs a
   * synchronous REST endpoint).
   */
  async publishWhatsappSend(payload: WhatsappSendPayload): Promise<void> {
    await this.publish(EXCHANGES.events, 'whatsapp.sent.persist', payload as unknown as Record<string, any>);
  }

  async close(): Promise<void> {
    await this.publisher.close();
  }
}
