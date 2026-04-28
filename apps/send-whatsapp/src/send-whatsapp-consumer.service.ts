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

// EVO-952 Onda 2 — só caminho automation (publisher live em message-trigger).
// Campaign batch (Post('/campaign')) fica para Onda 4 — docs/migration/evo-952-wave-2-decisions.md §1/§5.
const BINDINGS: QueueBinding[] = [
  {
    exchange: EXCHANGES.whatsapp,
    routingKey: 'whatsapp.send',
    queue: 'send-whatsapp.whatsapp.send',
    bridgePath: '/internal/whatsapp/automation',
  },
];

@Injectable()
export class SendWhatsappConsumerService {
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
    await Promise.all(this.consumers.map((c) => c.shutdown().catch((err) => console.error('[send-whatsapp] consumer stop:', err))));
  }
}
