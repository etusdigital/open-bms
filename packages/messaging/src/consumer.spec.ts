import * as amqplib from 'amqplib';
import {
  AmqpConsumer,
  ConsumerAlreadyActiveError,
  ConsumerClosedError,
} from './consumer';
import { DLX, EXCHANGES } from './exchanges';
import type { ConsumerOptions, MessageContext } from './types';

jest.mock('amqplib');
const mockConnect = amqplib.connect as jest.Mock;

type ConsumeCallback = (msg: FakeMessage | null) => void;

function createMockChannel() {
  const handlers: Record<string, Array<(arg?: unknown) => void>> = {};
  let consumeCallback: ConsumeCallback | null = null;
  const ch = {
    on: jest.fn((event: string, handler: (arg?: unknown) => void) => {
      (handlers[event] ??= []).push(handler);
      return ch;
    }),
    emit(event: string, arg?: unknown) {
      for (const h of handlers[event] ?? []) h(arg);
    },
    assertExchange: jest.fn().mockResolvedValue({ exchange: 'x' }),
    assertQueue: jest.fn().mockResolvedValue({ queue: 'q' }),
    bindQueue: jest.fn().mockResolvedValue({}),
    prefetch: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn(async (_queue: string, cb: ConsumeCallback) => {
      consumeCallback = cb;
      return { consumerTag: 'tag-1' };
    }),
    ack: jest.fn(),
    nack: jest.fn(),
    cancel: jest.fn().mockResolvedValue({}),
    publish: jest.fn().mockReturnValue(true),
    waitForConfirms: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    deliver(msg: FakeMessage | null) {
      if (!consumeCallback) throw new Error('no consumer registered');
      consumeCallback(msg);
    },
  };
  return ch;
}

function createMockConn(
  channel: ReturnType<typeof createMockChannel>,
  publishChannel: ReturnType<typeof createMockChannel>,
) {
  const handlers: Record<string, Array<(arg?: unknown) => void>> = {};
  const conn = {
    on: jest.fn((event: string, handler: (arg?: unknown) => void) => {
      (handlers[event] ??= []).push(handler);
      return conn;
    }),
    emit(event: string, arg?: unknown) {
      for (const h of handlers[event] ?? []) h(arg);
    },
    createChannel: jest.fn().mockResolvedValue(channel),
    createConfirmChannel: jest.fn().mockResolvedValue(publishChannel),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return conn;
}

interface FakeMessage {
  fields: {
    routingKey: string;
    consumerTag: string;
    deliveryTag: number;
    redelivered: boolean;
    exchange: string;
  };
  properties: {
    contentType?: string;
    headers?: Record<string, unknown>;
    deliveryMode?: number;
  };
  content: Buffer;
}

function makeMessage(
  opts: {
    payload?: unknown;
    headers?: Record<string, unknown>;
    routingKey?: string;
    rawContent?: Buffer;
    contentType?: string;
    deliveryMode?: number;
  } = {},
): FakeMessage {
  const payload = opts.payload ?? { hello: 'world' };
  return {
    fields: {
      routingKey: opts.routingKey ?? 'email.send',
      consumerTag: 'tag-1',
      deliveryTag: 1,
      redelivered: false,
      exchange: EXCHANGES.email,
    },
    properties: {
      contentType: opts.contentType ?? 'application/json',
      headers: opts.headers ?? {},
      // Default to persistent (deliveryMode=2) since the Publisher defaults
      // persistent=true, matching the most common production case.
      deliveryMode: opts.deliveryMode ?? 2,
    },
    content: opts.rawContent ?? Buffer.from(JSON.stringify(payload), 'utf8'),
  };
}

const FAST_RETRY = { baseMs: 1, maxMs: 5, maxInitialRetries: 3 };
const QUEUE = 'send-email.email.send';
const DLQ_NAME = `${QUEUE}.dlq`;
const ROUTING_KEY = 'email.send';

const DEFAULT_OPTS: ConsumerOptions = {
  exchange: EXCHANGES.email,
  routingKey: ROUTING_KEY,
  queue: QUEUE,
  // Fast retry for test speed
  maxRetries: 3,
  backoffBaseMs: 1,
  backoffMaxMs: 5,
};

function setup() {
  const channel = createMockChannel();
  const publishChannel = createMockChannel();
  const conn = createMockConn(channel, publishChannel);
  mockConnect.mockResolvedValue(conn);
  const consumer = new AmqpConsumer(
    { url: 'amqp://test' },
    undefined,
    FAST_RETRY,
  );
  return { channel, publishChannel, conn, consumer };
}

const waitTick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe('AmqpConsumer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('consume() topology', () => {
    it('asserts exchange, DLX, queue, DLQ, and both bindings', async () => {
      const { channel, consumer } = setup();

      await consumer.consume(DEFAULT_OPTS, async () => 'ack');

      expect(channel.assertExchange).toHaveBeenCalledWith(
        EXCHANGES.email,
        'topic',
        { durable: true },
      );
      expect(channel.assertExchange).toHaveBeenCalledWith(DLX, 'topic', {
        durable: true,
      });
      expect(channel.assertQueue).toHaveBeenCalledWith(
        QUEUE,
        expect.objectContaining({ durable: true, exclusive: false, autoDelete: false }),
      );
      expect(channel.assertQueue).toHaveBeenCalledWith(
        DLQ_NAME,
        expect.objectContaining({ durable: true }),
      );
      expect(channel.bindQueue).toHaveBeenCalledWith(
        QUEUE,
        EXCHANGES.email,
        ROUTING_KEY,
      );
      expect(channel.bindQueue).toHaveBeenCalledWith(
        DLQ_NAME,
        DLX,
        ROUTING_KEY,
      );
    });

    it('defaults prefetch to 10', async () => {
      const { channel, consumer } = setup();
      await consumer.consume(DEFAULT_OPTS, async () => 'ack');
      expect(channel.prefetch).toHaveBeenCalledWith(10);
    });

    it('respects explicit prefetch override', async () => {
      const { channel, consumer } = setup();
      await consumer.consume({ ...DEFAULT_OPTS, prefetch: 50 }, async () => 'ack');
      expect(channel.prefetch).toHaveBeenCalledWith(50);
    });

    it('starts consuming the queue with manual ack', async () => {
      const { channel, consumer } = setup();
      await consumer.consume(DEFAULT_OPTS, async () => 'ack');
      expect(channel.consume).toHaveBeenCalledWith(
        QUEUE,
        expect.any(Function),
        { noAck: false },
      );
    });

    it('rejects a second consume() on the same instance', async () => {
      const { consumer } = setup();
      await consumer.consume(DEFAULT_OPTS, async () => 'ack');
      await expect(
        consumer.consume(DEFAULT_OPTS, async () => 'ack'),
      ).rejects.toBeInstanceOf(ConsumerAlreadyActiveError);
    });
  });

  describe('handler result translation', () => {
    it("acks when handler returns 'ack'", async () => {
      const { channel, consumer } = setup();
      await consumer.consume(DEFAULT_OPTS, async () => 'ack');
      const msg = makeMessage();
      channel.deliver(msg);
      await waitTick();
      expect(channel.ack).toHaveBeenCalledWith(msg);
      expect(channel.nack).not.toHaveBeenCalled();
    });

    it('acks when handler returns undefined', async () => {
      const { channel, consumer } = setup();
      await consumer.consume(DEFAULT_OPTS, async () => {
        /* noop returns undefined */
      });
      const msg = makeMessage();
      channel.deliver(msg);
      await waitTick();
      expect(channel.ack).toHaveBeenCalledWith(msg);
    });

    it("nacks with requeue=true when handler returns 'requeue'", async () => {
      const { channel, consumer } = setup();
      await consumer.consume(DEFAULT_OPTS, async () => 'requeue');
      const msg = makeMessage();
      channel.deliver(msg);
      await waitTick();
      expect(channel.nack).toHaveBeenCalledWith(msg, false, true);
      expect(channel.ack).not.toHaveBeenCalled();
    });
  });

  describe('MessageContext', () => {
    it('passes parsed payload and attempt=1 for fresh message', async () => {
      const { channel, consumer } = setup();
      const seen: Array<[unknown, MessageContext]> = [];
      await consumer.consume(DEFAULT_OPTS, async (payload, ctx) => {
        seen.push([payload, ctx]);
        return 'ack';
      });
      channel.deliver(makeMessage({ payload: { foo: 42 } }));
      await waitTick();

      expect(seen).toHaveLength(1);
      expect(seen[0]![0]).toEqual({ foo: 42 });
      expect(seen[0]![1]).toMatchObject({
        attempt: 1,
        routingKey: ROUTING_KEY,
        queue: QUEUE,
      });
    });

    it('extracts attempt from x-bms-attempt header', async () => {
      const { channel, consumer } = setup();
      let seenAttempt = 0;
      await consumer.consume(DEFAULT_OPTS, async (_, ctx) => {
        seenAttempt = ctx.attempt;
        return 'ack';
      });
      channel.deliver(
        makeMessage({ headers: { 'x-bms-attempt': 3 } }),
      );
      await waitTick();
      expect(seenAttempt).toBe(3);
    });

    it('coerces Buffer headers to strings', async () => {
      const { channel, consumer } = setup();
      let seenHeaders: Record<string, unknown> = {};
      await consumer.consume(DEFAULT_OPTS, async (_, ctx) => {
        seenHeaders = ctx.headers;
        return 'ack';
      });
      channel.deliver(
        makeMessage({
          headers: {
            'x-correlation-id': Buffer.from('abc-123', 'utf8'),
            'x-tags': [Buffer.from('a', 'utf8'), Buffer.from('b', 'utf8')],
            'x-attempt': 2,
          },
        }),
      );
      await waitTick();
      expect(seenHeaders['x-correlation-id']).toBe('abc-123');
      expect(seenHeaders['x-tags']).toEqual(['a', 'b']);
      expect(seenHeaders['x-attempt']).toBe(2);
    });
  });

  describe('retry path', () => {
    it('acks original and republishes to main exchange on handler nack', async () => {
      const { channel, publishChannel, consumer } = setup();
      await consumer.consume(DEFAULT_OPTS, async () => 'nack');

      const msg = makeMessage();
      channel.deliver(msg);
      await waitTick();

      expect(channel.ack).toHaveBeenCalledWith(msg);
      expect(publishChannel.publish).toHaveBeenCalledTimes(1);
      const [exchange, routingKey, content, options] =
        publishChannel.publish.mock.calls[0]!;
      expect(exchange).toBe(EXCHANGES.email);
      expect(routingKey).toBe(ROUTING_KEY);
      expect(content).toBe(msg.content);
      expect(options).toMatchObject({
        persistent: true,
        headers: expect.objectContaining({
          'x-bms-attempt': 2,
          'x-bms-first-error': 'handler returned nack',
          'x-bms-last-error': 'handler returned nack',
        }),
      });
    });

    it('preserves original deliveryMode when republishing for retry', async () => {
      const { channel, publishChannel, consumer } = setup();
      await consumer.consume(DEFAULT_OPTS, async () => 'nack');

      // Volatile message (deliveryMode=1) should not be promoted to persistent
      channel.deliver(makeMessage({ deliveryMode: 1 }));
      await waitTick();

      const opts = publishChannel.publish.mock.calls[0]?.[3] as {
        persistent: boolean;
      };
      expect(opts.persistent).toBe(false);
    });

    it('preserves original deliveryMode when routing to DLQ', async () => {
      const { channel, publishChannel, consumer } = setup();
      await consumer.consume(DEFAULT_OPTS, async () => {
        throw new Error('always fails');
      });

      // Volatile message at max retries → DLQ should stay volatile
      channel.deliver(
        makeMessage({
          deliveryMode: 1,
          headers: { 'x-bms-attempt': 3 },
        }),
      );
      await waitTick();

      const opts = publishChannel.publish.mock.calls[0]?.[3] as {
        persistent: boolean;
      };
      expect(opts.persistent).toBe(false);
    });

    it('captures thrown error message as first + last error', async () => {
      const { channel, publishChannel, consumer } = setup();
      await consumer.consume(DEFAULT_OPTS, async () => {
        throw new Error('downstream 500');
      });

      channel.deliver(makeMessage());
      await waitTick();

      const opts = publishChannel.publish.mock.calls[0]?.[3] as {
        headers: Record<string, unknown>;
      };
      expect(opts.headers['x-bms-first-error']).toBe('downstream 500');
      expect(opts.headers['x-bms-last-error']).toBe('downstream 500');
      expect(opts.headers['x-bms-attempt']).toBe(2);
    });

    it('preserves x-bms-first-error across subsequent retries', async () => {
      const { channel, publishChannel, consumer } = setup();
      await consumer.consume(DEFAULT_OPTS, async () => {
        throw new Error('second-fail');
      });

      // Incoming message already carries the original error from attempt 1
      channel.deliver(
        makeMessage({
          headers: {
            'x-bms-attempt': 2,
            'x-bms-first-error': 'first-fail',
          },
        }),
      );
      await waitTick();

      const opts = publishChannel.publish.mock.calls[0]?.[3] as {
        headers: Record<string, unknown>;
      };
      expect(opts.headers['x-bms-first-error']).toBe('first-fail');
      expect(opts.headers['x-bms-last-error']).toBe('second-fail');
      expect(opts.headers['x-bms-attempt']).toBe(3);
    });

    it('routes to DLX when attempt reaches maxRetries', async () => {
      const { channel, publishChannel, consumer } = setup();
      await consumer.consume(DEFAULT_OPTS, async () => {
        throw new Error('always fails');
      });

      // Simulate a message already at attempt=3 (== maxRetries)
      channel.deliver(
        makeMessage({
          headers: {
            'x-bms-attempt': 3,
            'x-bms-first-error': 'first-fail',
          },
        }),
      );
      await waitTick();

      expect(publishChannel.publish).toHaveBeenCalledTimes(1);
      const [exchange, routingKey, , options] =
        publishChannel.publish.mock.calls[0]!;
      expect(exchange).toBe(DLX);
      expect(routingKey).toBe(ROUTING_KEY);
      expect(options).toMatchObject({
        persistent: true,
        headers: expect.objectContaining({
          'x-bms-attempt': 3,
          'x-bms-first-error': 'first-fail',
          'x-bms-last-error': 'always fails',
        }),
      });
      expect(channel.ack).toHaveBeenCalled();
    });

    it('does not schedule further retry after DLQ exhaustion', async () => {
      const { channel, publishChannel, consumer } = setup();
      await consumer.consume(DEFAULT_OPTS, async () => {
        throw new Error('x');
      });

      channel.deliver(
        makeMessage({ headers: { 'x-bms-attempt': 3 } }),
      );
      await waitTick(50);

      // One publish — to DLX — and no subsequent republish to main
      expect(publishChannel.publish).toHaveBeenCalledTimes(1);
      expect(publishChannel.publish.mock.calls[0]![0]).toBe(DLX);
    });
  });

  describe('parse-error path', () => {
    it('routes malformed JSON to DLQ with x-bms-parse-error and skips handler', async () => {
      const { channel, publishChannel, consumer } = setup();
      const handler = jest.fn();
      await consumer.consume(DEFAULT_OPTS, handler);

      const msg = makeMessage({
        rawContent: Buffer.from('not-json{', 'utf8'),
      });
      channel.deliver(msg);
      await waitTick();

      expect(handler).not.toHaveBeenCalled();
      expect(publishChannel.publish).toHaveBeenCalledTimes(1);
      const [exchange, routingKey, content, options] =
        publishChannel.publish.mock.calls[0]!;
      expect(exchange).toBe(DLX);
      expect(routingKey).toBe(ROUTING_KEY);
      expect(content).toBe(msg.content);
      const headers = (options as { headers: Record<string, unknown> }).headers;
      expect(headers['x-bms-parse-error']).toEqual(expect.any(String));
      expect(channel.ack).toHaveBeenCalledWith(msg);
    });
  });

  describe('broker-canceled consumer', () => {
    it('ignores null message (queue deleted / broker cancel)', async () => {
      const { channel, consumer } = setup();
      const handler = jest.fn();
      await consumer.consume(DEFAULT_OPTS, handler);

      channel.deliver(null);
      await waitTick();

      expect(handler).not.toHaveBeenCalled();
      expect(channel.ack).not.toHaveBeenCalled();
      expect(channel.nack).not.toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('cancels consume tag, drains in-flight handler, closes channels + connection', async () => {
      const { channel, publishChannel, conn, consumer } = setup();
      let releaseHandler!: () => void;
      const handlerDone = new Promise<void>((r) => {
        releaseHandler = r;
      });

      await consumer.consume(DEFAULT_OPTS, async () => {
        await handlerDone;
        return 'ack';
      });

      channel.deliver(makeMessage());
      await waitTick(5);

      const shutdownP = consumer.shutdown();
      await waitTick(5);

      expect(channel.cancel).toHaveBeenCalledWith('tag-1');
      expect(channel.close).not.toHaveBeenCalled();

      releaseHandler();
      await shutdownP;

      expect(channel.ack).toHaveBeenCalled();
      expect(channel.close).toHaveBeenCalled();
      expect(publishChannel.close).toHaveBeenCalled();
      expect(conn.close).toHaveBeenCalled();
    });

    it('is idempotent across concurrent and repeated calls', async () => {
      const { channel, consumer } = setup();
      await consumer.consume(DEFAULT_OPTS, async () => 'ack');

      const [a, b, c] = await Promise.all([
        consumer.shutdown(),
        consumer.shutdown(),
        consumer.shutdown(),
      ]);

      expect(a).toBeUndefined();
      expect(b).toBeUndefined();
      expect(c).toBeUndefined();
      expect(channel.cancel).toHaveBeenCalledTimes(1);
      expect(channel.close).toHaveBeenCalledTimes(1);
    });

    it('is a fast path when called before consume()', async () => {
      const channel = createMockChannel();
      const pub = createMockChannel();
      const conn = createMockConn(channel, pub);
      mockConnect.mockResolvedValue(conn);

      const consumer = new AmqpConsumer(
        { url: 'amqp://test' },
        undefined,
        FAST_RETRY,
      );
      await consumer.shutdown();

      expect(mockConnect).not.toHaveBeenCalled();
      expect(channel.cancel).not.toHaveBeenCalled();
      expect(channel.close).not.toHaveBeenCalled();
    });

    it('rejects consume() after shutdown with ConsumerClosedError', async () => {
      const { consumer } = setup();
      await consumer.shutdown();
      await expect(
        consumer.consume(DEFAULT_OPTS, async () => 'ack'),
      ).rejects.toBeInstanceOf(ConsumerClosedError);
    });

    it('force-closes after timeout when in-flight handler hangs', async () => {
      const channel = createMockChannel();
      const pub = createMockChannel();
      const conn = createMockConn(channel, pub);
      mockConnect.mockResolvedValue(conn);

      // Short shutdown timeout for the test
      const consumer = new AmqpConsumer(
        { url: 'amqp://test' },
        20,
        FAST_RETRY,
      );

      await consumer.consume(DEFAULT_OPTS, async () => {
        // Never resolves
        return new Promise<'ack'>(() => {});
      });

      channel.deliver(makeMessage());
      await waitTick(5);

      const started = Date.now();
      await consumer.shutdown();
      const elapsed = Date.now() - started;

      expect(elapsed).toBeGreaterThanOrEqual(15);
      expect(elapsed).toBeLessThan(200);
      expect(channel.close).toHaveBeenCalled();
      expect(conn.close).toHaveBeenCalled();
    });

    it('clears pending retry timers on shutdown timeout', async () => {
      const channel = createMockChannel();
      const pub = createMockChannel();
      const conn = createMockConn(channel, pub);
      mockConnect.mockResolvedValue(conn);

      // Long backoff so the timer is still pending when shutdown fires
      const consumer = new AmqpConsumer(
        { url: 'amqp://test' },
        20,
        FAST_RETRY,
      );
      await consumer.consume(
        { ...DEFAULT_OPTS, backoffBaseMs: 5_000, backoffMaxMs: 5_000 },
        async () => 'nack',
      );

      channel.deliver(makeMessage());
      await waitTick(5);

      // Timer should be pending now; handler acked but retry not yet fired
      expect(channel.ack).toHaveBeenCalled();
      expect(pub.publish).not.toHaveBeenCalled();

      await consumer.shutdown();

      // Even after the long backoff, no republish should happen (timer cleared)
      await waitTick(50);
      expect(pub.publish).not.toHaveBeenCalled();
    });

    it('drains when a retry timer fires before shutdown timeout', async () => {
      const channel = createMockChannel();
      const pub = createMockChannel();
      const conn = createMockConn(channel, pub);
      mockConnect.mockResolvedValue(conn);

      // Plenty of shutdown time; short backoff so timer fires quickly
      const consumer = new AmqpConsumer(
        { url: 'amqp://test' },
        500,
        FAST_RETRY,
      );
      await consumer.consume(
        { ...DEFAULT_OPTS, backoffBaseMs: 10, backoffMaxMs: 10 },
        async () => 'nack',
      );

      channel.deliver(makeMessage());
      await waitTick(2);

      const started = Date.now();
      await consumer.shutdown();
      const elapsed = Date.now() - started;

      // Should complete as soon as timer fires (~10ms), not wait full 500ms
      expect(elapsed).toBeLessThan(200);
      expect(channel.close).toHaveBeenCalled();
    });
  });

  describe('reconnect', () => {
    it('re-asserts topology and reopens consume tag after broker reconnect', async () => {
      const channel1 = createMockChannel();
      const pub1 = createMockChannel();
      const channel2 = createMockChannel();
      const pub2 = createMockChannel();
      const conn1 = createMockConn(channel1, pub1);
      const conn2 = createMockConn(channel2, pub2);
      mockConnect.mockResolvedValueOnce(conn1).mockResolvedValueOnce(conn2);

      const consumer = new AmqpConsumer(
        { url: 'amqp://test' },
        undefined,
        FAST_RETRY,
      );
      await consumer.consume(DEFAULT_OPTS, async () => 'ack');

      expect(channel1.assertExchange).toHaveBeenCalled();
      expect(channel1.consume).toHaveBeenCalled();

      // Simulate connection loss
      conn1.emit('close');

      await waitTick(50);

      expect(channel2.assertExchange).toHaveBeenCalledWith(
        EXCHANGES.email,
        'topic',
        { durable: true },
      );
      expect(channel2.assertExchange).toHaveBeenCalledWith(DLX, 'topic', {
        durable: true,
      });
      expect(channel2.assertQueue).toHaveBeenCalledWith(
        QUEUE,
        expect.objectContaining({ durable: true }),
      );
      expect(channel2.consume).toHaveBeenCalledWith(
        QUEUE,
        expect.any(Function),
        { noAck: false },
      );
    });

    it('does not reestablish while shutting down', async () => {
      const channel1 = createMockChannel();
      const pub1 = createMockChannel();
      const channel2 = createMockChannel();
      const pub2 = createMockChannel();
      const conn1 = createMockConn(channel1, pub1);
      const conn2 = createMockConn(channel2, pub2);
      mockConnect.mockResolvedValueOnce(conn1).mockResolvedValueOnce(conn2);

      const consumer = new AmqpConsumer(
        { url: 'amqp://test' },
        undefined,
        FAST_RETRY,
      );
      await consumer.consume(DEFAULT_OPTS, async () => 'ack');

      // Fire shutdown and a reconnect-triggering close concurrently
      const shutdownP = consumer.shutdown();
      conn1.emit('close');
      await shutdownP;
      await waitTick(50);

      // Reconnect may still happen at AmqpConnection layer but Consumer.reestablish
      // should have skipped re-asserting topology on a fresh channel
      expect(channel2.assertExchange).not.toHaveBeenCalled();
      expect(channel2.consume).not.toHaveBeenCalled();
    });
  });
});
