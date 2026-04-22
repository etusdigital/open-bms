import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import * as amqplib from 'amqplib';
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from 'testcontainers';
import {
  AmqpConsumer,
  AmqpPublisher,
  createHttpBridgeHandler,
  DLX,
  EXCHANGES,
} from '../../src';

let container: StartedTestContainer;
let amqpUrl: string;

beforeAll(async () => {
  container = await new GenericContainer('rabbitmq:3.13-management')
    .withExposedPorts(5672, 15672)
    .withWaitStrategy(
      Wait.forLogMessage(/Server startup complete/, 1),
    )
    .start();
  const host = container.getHost();
  const port = container.getMappedPort(5672);
  amqpUrl = `amqp://guest:guest@${host}:${port}`;
}, 120_000);

afterAll(async () => {
  if (container) await container.stop();
}, 30_000);

function uniqueQueue(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
}

function strOrBuffer(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Buffer.isBuffer(v)) return v.toString('utf8');
  return undefined;
}

async function waitUntil(
  pred: () => boolean,
  timeout = 10_000,
  interval = 25,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error('waitUntil: predicate never satisfied');
}

interface DlqInspection {
  payload: unknown;
  headers: Record<string, unknown>;
}

async function popFromQueue(
  queueName: string,
  timeoutMs = 5000,
): Promise<DlqInspection> {
  const conn = await amqplib.connect(amqpUrl);
  const ch = await conn.createChannel();
  try {
    return await new Promise<DlqInspection>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Queue ${queueName} empty after ${timeoutMs}ms`));
      }, timeoutMs);
      void ch.consume(
        queueName,
        (msg) => {
          if (!msg) return;
          clearTimeout(timer);
          ch.ack(msg);
          resolve({
            payload: JSON.parse(msg.content.toString('utf8')),
            headers: msg.properties.headers ?? {},
          });
        },
        { noAck: false },
      );
    });
  } finally {
    await conn.close();
  }
}

async function queueDepth(queueName: string): Promise<number> {
  const conn = await amqplib.connect(amqpUrl);
  const ch = await conn.createChannel();
  try {
    const info = await ch.checkQueue(queueName);
    return info.messageCount;
  } finally {
    await conn.close();
  }
}

describe('AmqpPublisher + AmqpConsumer integration', () => {
  it('T1 — publish → consume roundtrip completes in under 1s', async () => {
    const queue = uniqueQueue('t1.email.send');
    const routingKey = 'email.send';
    const publisher = new AmqpPublisher({ url: amqpUrl });
    const consumer = new AmqpConsumer({ url: amqpUrl }, 5000);

    let received: unknown = null;
    let resolveReceived!: () => void;
    const gotMsg = new Promise<void>((r) => {
      resolveReceived = r;
    });

    await consumer.consume(
      { exchange: EXCHANGES.email, routingKey, queue },
      async (payload) => {
        received = payload;
        resolveReceived();
        return 'ack';
      },
    );

    const started = Date.now();
    await publisher.publish({
      exchange: EXCHANGES.email,
      routingKey,
      payload: { hello: 'world', n: 42 },
    });
    await gotMsg;
    const elapsed = Date.now() - started;

    expect(received).toEqual({ hello: 'world', n: 42 });
    expect(elapsed).toBeLessThan(1000);

    await publisher.close();
    await consumer.shutdown();
  }, 30_000);

  it('T2 — handler exhausts retries and message lands in DLQ with attempt + error headers', async () => {
    const queue = uniqueQueue('t2.email.send');
    const routingKey = 'email.send';
    const publisher = new AmqpPublisher({ url: amqpUrl });
    const consumer = new AmqpConsumer({ url: amqpUrl }, 5000);

    let deliveries = 0;
    await consumer.consume(
      {
        exchange: EXCHANGES.email,
        routingKey,
        queue,
        maxRetries: 2,
        backoffBaseMs: 50,
        backoffMaxMs: 100,
      },
      async () => {
        deliveries += 1;
        throw new Error('always-fails');
      },
    );

    await publisher.publish({
      exchange: EXCHANGES.email,
      routingKey,
      payload: { id: 't2' },
    });

    await waitUntil(() => deliveries >= 2, 5000);

    const dlqMsg = await popFromQueue(`${queue}.dlq`, 5000);
    expect(dlqMsg.payload).toEqual({ id: 't2' });
    expect(dlqMsg.headers['x-bms-attempt']).toBe(2);
    expect(strOrBuffer(dlqMsg.headers['x-bms-first-error'])).toBe(
      'always-fails',
    );
    expect(strOrBuffer(dlqMsg.headers['x-bms-last-error'])).toBe(
      'always-fails',
    );

    await publisher.close();
    await consumer.shutdown();
  }, 30_000);

  it('T3 — requeue does not increment attempt across redeliveries', async () => {
    const queue = uniqueQueue('t3.email.send');
    const routingKey = 'email.send';
    const publisher = new AmqpPublisher({ url: amqpUrl });
    const consumer = new AmqpConsumer({ url: amqpUrl }, 5000);

    const attempts: number[] = [];
    let deliveries = 0;

    await consumer.consume(
      { exchange: EXCHANGES.email, routingKey, queue },
      async (_, ctx) => {
        deliveries += 1;
        attempts.push(ctx.attempt);
        if (deliveries < 4) return 'requeue';
        return 'ack';
      },
    );

    await publisher.publish({
      exchange: EXCHANGES.email,
      routingKey,
      payload: { id: 't3' },
    });

    await waitUntil(() => deliveries >= 4, 5000);

    expect(attempts).toEqual([1, 1, 1, 1]);

    await publisher.close();
    await consumer.shutdown();
  }, 30_000);

  it('T4 — graceful shutdown drains in-flight handlers before closing', async () => {
    const queue = uniqueQueue('t4.email.send');
    const routingKey = 'email.send';
    const publisher = new AmqpPublisher({ url: amqpUrl });
    const consumer = new AmqpConsumer({ url: amqpUrl }, 5000);

    const completed: number[] = [];
    let startedCount = 0;

    await consumer.consume(
      { exchange: EXCHANGES.email, routingKey, queue },
      async (payload) => {
        startedCount += 1;
        await new Promise((r) => setTimeout(r, 300));
        completed.push((payload as { i: number }).i);
        return 'ack';
      },
    );

    for (let i = 0; i < 5; i++) {
      await publisher.publish({
        exchange: EXCHANGES.email,
        routingKey,
        payload: { i },
      });
    }

    // Wait for at least some handlers to start
    await waitUntil(() => startedCount >= 3, 2000);

    await consumer.shutdown();

    // All 5 should have completed before shutdown returned
    expect(completed).toHaveLength(5);
    expect(new Set(completed)).toEqual(new Set([0, 1, 2, 3, 4]));
    // Queue should be empty (all acked)
    expect(await queueDepth(queue)).toBe(0);

    await publisher.close();
  }, 30_000);

  it('T5 — shutdown timeout force-closes; unacked messages redeliver to fresh consumer', async () => {
    const queue = uniqueQueue('t5.email.send');
    const routingKey = 'email.send';
    const publisher = new AmqpPublisher({ url: amqpUrl });
    const hangingConsumer = new AmqpConsumer({ url: amqpUrl }, 500);

    let hangReleased = false;
    let hangTimer: NodeJS.Timeout | undefined;
    const hangHandle = { resolve: () => {} };
    const hangPromise = new Promise<'ack'>((resolve) => {
      hangHandle.resolve = () => {
        if (hangTimer) clearTimeout(hangTimer);
        hangReleased = true;
        resolve('ack');
      };
      // Safety: release after 30s in case the test fails before cleanup.
      // Timer is cleared the moment hangHandle.resolve() runs normally,
      // so Jest doesn't see a leaked handle.
      hangTimer = setTimeout(() => hangHandle.resolve(), 30_000);
    });

    await hangingConsumer.consume(
      { exchange: EXCHANGES.email, routingKey, queue },
      async () => hangPromise,
    );

    await publisher.publish({
      exchange: EXCHANGES.email,
      routingKey,
      payload: { id: 't5' },
    });

    // Give the handler a moment to pick up the msg
    await new Promise((r) => setTimeout(r, 200));

    const started = Date.now();
    await hangingConsumer.shutdown();
    const elapsed = Date.now() - started;

    expect(elapsed).toBeGreaterThanOrEqual(400);
    expect(elapsed).toBeLessThan(2000);
    expect(hangReleased).toBe(false); // timeout force-closed without waiting

    // The unacked msg should still be in the queue (broker returns unacked on channel close)
    await waitUntil(async () => (await queueDepth(queue)) === 1, 3000).catch(
      () => {},
    );
    expect(await queueDepth(queue)).toBe(1);

    // Fresh consumer picks it up
    const freshConsumer = new AmqpConsumer({ url: amqpUrl }, 5000);
    let redelivered: unknown = null;
    let resolveRedelivered!: () => void;
    const got = new Promise<void>((r) => {
      resolveRedelivered = r;
    });

    await freshConsumer.consume(
      { exchange: EXCHANGES.email, routingKey, queue },
      async (payload) => {
        redelivered = payload;
        resolveRedelivered();
        return 'ack';
      },
    );

    await got;
    expect(redelivered).toEqual({ id: 't5' });

    // Release the original hang handler so jest can shut down cleanly
    hangHandle.resolve();

    await publisher.close();
    await freshConsumer.shutdown();
  }, 45_000);

  it('T6 — createHttpBridgeHandler routes AMQP msg through local HTTP service and acks on 2xx', async () => {
    const queue = uniqueQueue('t6.email.send');
    const routingKey = 'email.send';

    let receivedPath: string | undefined;
    let receivedToken: string | undefined;
    let receivedAttempt: string | undefined;
    let receivedBody: unknown;

    const server: Server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c as Buffer));
      req.on('end', () => {
        receivedPath = req.url;
        receivedToken = req.headers['x-internal-token'] as string | undefined;
        receivedAttempt = req.headers['x-bms-attempt'] as string | undefined;
        receivedBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        res.statusCode = 200;
        res.end('ok');
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as AddressInfo).port;

    const publisher = new AmqpPublisher({ url: amqpUrl });
    const consumer = new AmqpConsumer({ url: amqpUrl }, 5000);

    const handler = createHttpBridgeHandler({
      endpoint: `http://127.0.0.1:${port}/internal/email/send`,
      token: 'bridge-token',
    });

    await consumer.consume(
      { exchange: EXCHANGES.email, routingKey, queue },
      handler,
    );

    await publisher.publish({
      exchange: EXCHANGES.email,
      routingKey,
      payload: { id: 't6' },
    });

    await waitUntil(() => receivedBody != null, 5000);

    expect(receivedPath).toBe('/internal/email/send');
    expect(receivedToken).toBe('bridge-token');
    expect(receivedAttempt).toBe('1');
    expect(receivedBody).toEqual({ id: 't6' });

    await waitUntil(async () => (await queueDepth(queue)) === 0, 3000);
    expect(await queueDepth(queue)).toBe(0);

    await publisher.close();
    await consumer.shutdown();
    await new Promise<void>((r) => server.close(() => r()));
  }, 30_000);

  it('T7 — createHttpBridgeHandler retries on 5xx and eventually acks', async () => {
    const queue = uniqueQueue('t7.email.send');
    const routingKey = 'email.send';

    const seenAttempts: string[] = [];
    const server: Server = createServer((req, res) => {
      const attempt = req.headers['x-bms-attempt'] as string;
      seenAttempts.push(attempt);
      req.on('data', () => {});
      req.on('end', () => {
        // Fail the first attempt with 503, succeed on the second
        res.statusCode = seenAttempts.length === 1 ? 503 : 200;
        res.end('');
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as AddressInfo).port;

    const publisher = new AmqpPublisher({ url: amqpUrl });
    const consumer = new AmqpConsumer({ url: amqpUrl }, 5000);

    const handler = createHttpBridgeHandler({
      endpoint: `http://127.0.0.1:${port}/`,
      token: 't',
    });

    await consumer.consume(
      {
        exchange: EXCHANGES.email,
        routingKey,
        queue,
        maxRetries: 3,
        backoffBaseMs: 50,
        backoffMaxMs: 100,
      },
      handler,
    );

    await publisher.publish({
      exchange: EXCHANGES.email,
      routingKey,
      payload: { id: 't7' },
    });

    await waitUntil(() => seenAttempts.length >= 2, 5000);

    expect(seenAttempts).toEqual(['1', '2']);
    await waitUntil(async () => (await queueDepth(queue)) === 0, 3000);

    await publisher.close();
    await consumer.shutdown();
    await new Promise<void>((r) => server.close(() => r()));
  }, 30_000);
});
