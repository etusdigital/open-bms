import { Injectable } from '@nestjs/common';
import { AmqpConsumer, createHttpBridgeHandler, EXCHANGES } from '@bms/messaging';

const SHUTDOWN_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

interface QueueBinding {
  exchange: (typeof EXCHANGES)[keyof typeof EXCHANGES];
  routingKey: string;
  queue: string;
  bridgePath: string;
}

const BINDINGS: QueueBinding[] = [
  {
    exchange: EXCHANGES.email,
    routingKey: 'email.send',
    queue: 'send-email.email.send',
    bridgePath: '/internal/email/send',
  },
  {
    exchange: EXCHANGES.campaigns,
    routingKey: 'campaign.send',
    queue: 'send-email.campaign.send',
    bridgePath: '/internal/campaigns/send',
  },
  {
    exchange: EXCHANGES.triggers,
    routingKey: 'trigger.process',
    queue: 'send-email.trigger.process',
    bridgePath: '/internal/automations/process',
  },
];

@Injectable()
export class SendEmailConsumerService {
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
            exchange: binding.exchange,
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
    await Promise.all(this.consumers.map((c) => c.shutdown().catch((err) => console.error('[send-email] consumer stop:', err))));
  }
}
