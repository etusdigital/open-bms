import { Injectable } from '@nestjs/common';
import { AmqpConsumer, EXCHANGES, type Handler } from '@bms/messaging';

const SHUTDOWN_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const HTTP_TIMEOUT_MS = 30_000;

interface QueueBinding {
  exchange: (typeof EXCHANGES)[keyof typeof EXCHANGES];
  routingKey: string;
  queue: string;
  bridgePath: string;
}

const BINDINGS: QueueBinding[] = [
  {
    exchange: EXCHANGES.triggers,
    routingKey: 'trigger.process',
    queue: 'message-trigger.trigger.process',
    bridgePath: '/internal/trigger/process',
  },
];

function buildHandler(config: { bridgeBase: string; token: string; bridgePath: string }): Handler {
  return async (payload, ctx) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${config.bridgeBase}${config.bridgePath}`, {
        method: 'POST',
        headers: {
          'X-Internal-Token': config.token,
          'Content-Type': 'application/json',
          'X-Bms-Attempt': String(ctx.attempt),
          'X-Bms-Routing-Key': ctx.routingKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) return 'nack';
      throw err;
    } finally {
      clearTimeout(timer);
    }

    try {
      await res.body?.cancel();
    } catch {
      // best effort
    }

    if (res.status === 429 || res.status >= 500) return 'nack';
    return 'ack';
  };
}

@Injectable()
export class MessageTriggerConsumerService {
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
        const handler = buildHandler({ bridgeBase, token, bridgePath: binding.bridgePath });
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
    await Promise.all(this.consumers.map((c) => c.shutdown().catch((err) => console.error('[message-trigger] consumer stop:', err))));
  }
}
