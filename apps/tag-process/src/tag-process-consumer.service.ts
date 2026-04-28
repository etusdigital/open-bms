import { Injectable } from '@nestjs/common';
import { AmqpConsumer, EXCHANGES, type Handler } from '@bms/messaging';

const SHUTDOWN_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const HTTP_TIMEOUT_MS = 30_000;

interface QueueBinding {
  routingKey: string;
  queue: string;
}

const BINDINGS: QueueBinding[] = [
  {
    routingKey: 'tag.process',
    queue: 'tag-process.tag.process',
  },
];

const ENDPOINT_BY_TYPE: Record<string, string> = {
  add: '/internal/automation/add',
  remove: '/internal/automation/remove',
  cancel: '/internal/automation/cancel',
  completed: '/internal/automation/completed',
  'automation-target': '/internal/automation/target-achieved',
  'events-trigger': '/internal/automation/events-trigger',
};

function createTagBridgeHandler(config: { bridgeBase: string; token: string }): Handler {
  return async (payload, ctx) => {
    const type = String(ctx.headers?.type ?? '');

    // Drop warmup messages emitted by lead-conception's TagPublisherService.warmup()
    if (ctx.routingKey === 'tag.warmup.ignore') return 'ack';

    const path = ENDPOINT_BY_TYPE[type];
    if (!path) {
      console.warn(
        `[tag-process] dropping AMQP message with unknown type=${JSON.stringify(type)} routingKey=${ctx.routingKey}`,
      );
      return 'ack';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${config.bridgeBase}${path}`, {
        method: 'POST',
        headers: {
          'X-Internal-Token': config.token,
          'Content-Type': 'application/json',
          'X-Bms-Attempt': String(ctx.attempt),
          'X-Bms-Routing-Key': ctx.routingKey,
          'X-Bms-Type': type,
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
export class TagProcessConsumerService {
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
    const handler = createTagBridgeHandler({
      bridgeBase: process.env.BRIDGE_ENDPOINT!,
      token: process.env.INTERNAL_AUTH_TOKEN!,
    });

    await Promise.all(
      BINDINGS.map((binding, i) =>
        this.consumers[i].consume(
          {
            exchange: EXCHANGES.tags,
            routingKey: binding.routingKey,
            queue: binding.queue,
            maxRetries: MAX_RETRIES,
          },
          handler,
        ),
      ),
    );
  }

  async stop(): Promise<void> {
    await Promise.all(
      this.consumers.map((c) => c.shutdown().catch((err) => console.error('[tag-process] consumer stop:', err))),
    );
  }
}
