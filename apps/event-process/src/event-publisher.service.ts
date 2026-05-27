import { Injectable } from '@nestjs/common';
import { AmqpPublisher, type ExchangeName } from '@bms/messaging';

@Injectable()
export class EventPublisherService {
  private readonly publisher: AmqpPublisher;

  constructor() {
    if (!process.env.AMQP_URL) {
      throw new Error('AMQP_URL environment variable is required');
    }
    this.publisher = new AmqpPublisher({ url: process.env.AMQP_URL });
  }

  async publish(
    exchange: ExchangeName,
    routingKey: string,
    payload: Record<string, any>,
    customAttributes: Record<string, any> = {},
  ): Promise<void> {
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

    await this.publisher.publish({ exchange, routingKey, payload, headers });
  }

  async close(): Promise<void> {
    await this.publisher.close();
  }
}
