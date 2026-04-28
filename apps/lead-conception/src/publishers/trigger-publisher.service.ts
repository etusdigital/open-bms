import { Injectable, OnModuleInit } from '@nestjs/common';
import { AmqpPublisher, EXCHANGES } from '@bms/messaging';

@Injectable()
export class TriggerPublisherService implements OnModuleInit {
  private readonly publisher: AmqpPublisher;

  constructor() {
    if (!process.env.AMQP_URL) {
      throw new Error('AMQP_URL environment variable is required');
    }
    this.publisher = new AmqpPublisher({ url: process.env.AMQP_URL });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.warmup();
    } catch (err) {
      try {
        await this.publisher.close();
      } catch {
        // best-effort
      }
      throw err;
    }
  }

  async warmup(): Promise<void> {
    await this.publisher.publish({
      exchange: EXCHANGES.triggers,
      routingKey: 'trigger.warmup.ignore',
      payload: { warmup: true },
    });
  }

  async publish(message: Record<string, any>, attributes: Record<string, string> = {}): Promise<void> {
    const headers: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(attributes)) {
      if (typeof value === 'string' || typeof value === 'number') headers[key] = value;
    }
    await this.publisher.publish({ exchange: EXCHANGES.triggers, routingKey: 'trigger.process', payload: message, headers });
  }

  async close(): Promise<void> {
    await this.publisher.close();
  }
}
