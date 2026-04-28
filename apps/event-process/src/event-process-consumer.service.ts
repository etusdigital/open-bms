import { Injectable } from '@nestjs/common';
import { AmqpConsumer, createHttpBridgeHandler, EXCHANGES } from '@bms/messaging';

const SHUTDOWN_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

interface QueueBinding {
  routingKey: string;
  queue: string;
  bridgePath: string;
}

const BINDINGS: QueueBinding[] = [
  {
    routingKey: 'event.received.sendgrid',
    queue: 'event-process.event.received.sendgrid',
    bridgePath: '/internal/event/sendgrid',
  },
  {
    routingKey: 'event.received.sparkpost',
    queue: 'event-process.event.received.sparkpost',
    bridgePath: '/internal/event/sparkpost',
  },
  {
    routingKey: 'event.received.twilio',
    queue: 'event-process.event.received.twilio',
    bridgePath: '/internal/event/twilio',
  },
  { routingKey: 'event.received.push', queue: 'event-process.event.received.push', bridgePath: '/internal/event/push' },
  {
    routingKey: 'event.received.custom',
    queue: 'event-process.event.received.custom',
    bridgePath: '/internal/event/custom',
  },
  {
    routingKey: 'event.received.internal',
    queue: 'event-process.event.received.internal',
    bridgePath: '/internal/event/internal',
  },
];

@Injectable()
export class EventProcessConsumerService {
  private readonly consumers: AmqpConsumer[] = [];

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
    for (let i = 0; i < BINDINGS.length; i++) {
      this.consumers.push(new AmqpConsumer({ url: process.env.AMQP_URL }, SHUTDOWN_TIMEOUT_MS));
    }
  }

  async start(): Promise<void> {
    const bridgeBase = process.env.BRIDGE_ENDPOINT!;
    const token = process.env.INTERNAL_AUTH_TOKEN!;

    await Promise.all(
      BINDINGS.map((binding, i) => {
        const handler = createHttpBridgeHandler({
          endpoint: `${bridgeBase}${binding.bridgePath}`,
          token,
        });
        return this.consumers[i].consume(
          {
            exchange: EXCHANGES.events,
            routingKey: binding.routingKey,
            queue: binding.queue,
            maxRetries: MAX_RETRIES,
          },
          handler,
        );
      }),
    );
  }

  async stop(): Promise<void> {
    await Promise.all(
      this.consumers.map((c) => c.shutdown().catch((err) => console.error('[event-process] consumer stop:', err))),
    );
  }
}
