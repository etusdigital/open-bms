import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AmqpPublisher, EXCHANGES } from '@bms/messaging';

export const ANALYTICS_ROUTING_KEY = 'event.enriched';

@Injectable()
export class AnalyticsPublisherProvider implements OnModuleInit, OnModuleDestroy {
  private publisher!: AmqpPublisher;

  async onModuleInit(): Promise<void> {
    if (!process.env.AMQP_URL) {
      throw new Error('AMQP_URL environment variable is required');
    }
    this.publisher = new AmqpPublisher({ url: process.env.AMQP_URL });
    try {
      await this.warmup();
    } catch (err) {
      try {
        await this.publisher.close();
      } catch (closeErr) {
        console.warn('[AnalyticsPublisher] failed to close after warmup error', closeErr);
      }
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.publisher) return;
    try {
      await this.publisher.close();
    } catch (err) {
      console.warn('[AnalyticsPublisher] failed to close publisher', err);
    }
  }

  // Asserts the analytics exchange (and DLX) without publishing any payload,
  // so warmup is robust to future binding-pattern changes on the CH engine
  // side (e.g. widening to `event.#`) — no sentinel message can leak into
  // events_queue and trip the JSONEachRow consumer into consume-and-drop.
  async warmup(): Promise<void> {
    await this.publisher.ensureReady(EXCHANGES.analytics);
  }

  async publish(payload: Record<string, unknown>): Promise<void> {
    await this.publisher.publish({
      exchange: EXCHANGES.analytics,
      routingKey: ANALYTICS_ROUTING_KEY,
      payload,
    });
  }
}
