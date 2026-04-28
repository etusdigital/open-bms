import { Injectable } from '@nestjs/common';
import { AmqpPublisher, EXCHANGES } from '@bms/messaging';

const PLATFORM_ALLOWLIST = new Set(['sendgrid', 'sparkpost', 'twilio', 'push', 'custom', 'webhook', 'internal', 'unknown']);

const PLATFORM_NORMALIZATIONS: Record<string, string> = {
  custom_events: 'custom',
};

export function sanitizePlatform(raw: unknown): string {
  if (typeof raw !== 'string') return 'unknown';
  const lower = raw.toLowerCase();
  const normalized = PLATFORM_NORMALIZATIONS[lower] ?? lower;
  if (PLATFORM_ALLOWLIST.has(normalized)) return normalized;
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[EventPublisher] unknown platform "${raw}", falling back to 'unknown'`);
  }
  return 'unknown';
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

  async publish(message: Record<string, any>, customAttributes: Record<string, any> = {}): Promise<void> {
    const platform = sanitizePlatform(customAttributes.platform);
    const routingKey = `event.received.${platform}`;

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
      console.log('[EventPublisher] publishing', { routingKey, message });
    }

    await this.publisher.publish({
      exchange: EXCHANGES.events,
      routingKey,
      payload: message,
      headers,
    });
  }

  async close(): Promise<void> {
    await this.publisher.close();
  }
}
