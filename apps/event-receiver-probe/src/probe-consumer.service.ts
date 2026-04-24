import { Injectable } from '@nestjs/common';
import { AmqpConsumer, createHttpBridgeHandler, EXCHANGES } from '@bms/messaging';

const SHUTDOWN_TIMEOUT_MS = 10_000;

@Injectable()
export class ProbeConsumerService {
  private readonly consumer: AmqpConsumer;

  constructor() {
    if (!process.env.AMQP_URL) {
      throw new Error('AMQP_URL environment variable is required');
    }
    if (!process.env.INTERNAL_AUTH_TOKEN) {
      throw new Error('INTERNAL_AUTH_TOKEN environment variable is required');
    }
    if (!process.env.BRIDGE_ENDPOINT) {
      throw new Error('BRIDGE_ENDPOINT environment variable is required');
    }
    this.consumer = new AmqpConsumer({ url: process.env.AMQP_URL }, SHUTDOWN_TIMEOUT_MS);
  }

  async start(): Promise<void> {
    const handler = createHttpBridgeHandler({
      endpoint: process.env.BRIDGE_ENDPOINT!,
      token: process.env.INTERNAL_AUTH_TOKEN!,
    });
    await this.consumer.consume(
      {
        exchange: EXCHANGES.events,
        routingKey: 'event.received.sendgrid',
        queue: 'event-process-probe.event.received.sendgrid',
        maxRetries: 3,
      },
      handler,
    );
  }

  async stop(): Promise<void> {
    await this.consumer.shutdown();
  }
}
