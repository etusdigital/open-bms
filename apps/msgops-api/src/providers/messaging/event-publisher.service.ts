import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AmqpPublisher, EXCHANGES, type ExchangeName } from '@bms/messaging';

// Exchanges this hub publishes to. Asserted at boot via `ensureReady` so a
// missing/down RabbitMQ trips the failure on startup instead of on the first
// produce call (which can land 30+ minutes later, masking the misconfiguration).
const PUBLISHED_EXCHANGES: readonly ExchangeName[] = [EXCHANGES.email, EXCHANGES.push, EXCHANGES.sms, EXCHANGES.whatsapp, EXCHANGES.tags, EXCHANGES.events];

@Injectable()
export class EventPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly publisher: AmqpPublisher;

  constructor() {
    if (!process.env.AMQP_URL) {
      throw new Error('AMQP_URL environment variable is required');
    }
    this.publisher = new AmqpPublisher({ url: process.env.AMQP_URL });
  }

  async onModuleInit(): Promise<void> {
    for (const exchange of PUBLISHED_EXCHANGES) {
      await this.publisher.ensureReady(exchange);
    }
  }

  async publish(exchange: ExchangeName, routingKey: string, payload: Record<string, any>, customAttributes: Record<string, any> = {}): Promise<void> {
    const headers: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(customAttributes)) {
      if (typeof value === 'string' || typeof value === 'number') {
        headers[key] = value;
      } else if (typeof value === 'boolean') {
        headers[key] = value ? 'true' : 'false';
      } else {
        throw new TypeError(`[EventPublisher] unsupported header type for "${key}": ${typeof value}`);
      }
    }

    await this.publisher.publish({ exchange, routingKey, payload, headers });
  }

  async onModuleDestroy(): Promise<void> {
    await this.publisher.close().catch((err) => console.error('[EventPublisher] close failed:', err));
  }
}
