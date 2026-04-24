import type { Channel, ConfirmChannel, ConsumeMessage } from 'amqplib';
import { AmqpConnection, type RetryConfig } from './connection';
import { DLX } from './exchanges';
import { computeBackoffMs } from './retry';
import type { ConnectionOptions, Consumer, ConsumerOptions, Handler, HandlerResult, MessageContext } from './types';

export class ConsumerAlreadyActiveError extends Error {
  constructor() {
    super('AmqpConsumer is already consuming — create a new instance for a different queue');
    this.name = 'ConsumerAlreadyActiveError';
  }
}

export class ConsumerClosedError extends Error {
  constructor() {
    super('AmqpConsumer has been closed');
    this.name = 'ConsumerClosedError';
  }
}

const DEFAULT_PREFETCH = 10;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BACKOFF_BASE_MS = 1000;
const DEFAULT_BACKOFF_MAX_MS = 60_000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 30_000;

interface ActiveConsume {
  options: ConsumerOptions;
  handler: Handler<unknown>;
  consumeTag: string | null;
}

export class AmqpConsumer implements Consumer {
  private readonly conn: AmqpConnection;
  private channel: Channel | null = null;
  private publishChannel: ConfirmChannel | null = null;
  private active: ActiveConsume | null = null;
  private readonly inFlight = new Set<symbol>();
  private readonly inFlightTimers = new Set<NodeJS.Timeout>();
  private shuttingDown = false;
  private closed = false;
  private shutdownPromise: Promise<void> | null = null;
  private drainResolver: (() => void) | null = null;
  private reestablishing = false;
  private reconnectRegistered = false;
  private readonly shutdownTimeoutMs: number;

  constructor(opts: ConnectionOptions, shutdownTimeoutMs?: number, retry?: RetryConfig) {
    this.conn = new AmqpConnection(opts, retry);
    this.shutdownTimeoutMs = shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
  }

  async consume<T>(options: ConsumerOptions, handler: Handler<T>): Promise<void> {
    if (this.closed || this.shuttingDown) throw new ConsumerClosedError();
    if (this.active) throw new ConsumerAlreadyActiveError();

    this.active = {
      options,
      handler: handler as Handler<unknown>,
      consumeTag: null,
    };

    const channel = await this.conn.createChannel();
    const publishChannel = await this.conn.createConfirmChannel();
    this.channel = channel;
    this.publishChannel = publishChannel;

    await this.assertTopology(channel, options);
    await channel.prefetch(options.prefetch ?? DEFAULT_PREFETCH);

    const { consumerTag } = await channel.consume(
      options.queue,
      (msg) => {
        void this.handleMessage(msg);
      },
      { noAck: false },
    );
    this.active.consumeTag = consumerTag;

    if (!this.reconnectRegistered) {
      this.conn.onReconnect(() => {
        void this.reestablish();
      });
      this.reconnectRegistered = true;
    }
  }

  async shutdown(): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;
    this.shutdownPromise = this.doShutdown();
    return this.shutdownPromise;
  }

  private async doShutdown(): Promise<void> {
    this.shuttingDown = true;

    if (this.channel && this.active?.consumeTag) {
      try {
        await this.channel.cancel(this.active.consumeTag);
      } catch {
        // channel already gone — nothing to cancel
      }
    }

    await this.waitForDrain(this.shutdownTimeoutMs);

    if (this.channel) {
      try {
        await this.channel.close();
      } catch {
        // already closed
      }
      this.channel = null;
    }
    if (this.publishChannel) {
      try {
        await this.publishChannel.close();
      } catch {
        // already closed
      }
      this.publishChannel = null;
    }
    try {
      await this.conn.close();
    } catch {
      // already closed
    }

    this.closed = true;
  }

  private waitForDrain(timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.inFlight.size === 0 && this.inFlightTimers.size === 0) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        this.drainResolver = null;
        for (const t of this.inFlightTimers) clearTimeout(t);
        this.inFlightTimers.clear();
        resolve();
      }, timeoutMs);

      this.drainResolver = () => {
        if (this.inFlight.size === 0 && this.inFlightTimers.size === 0) {
          clearTimeout(timeout);
          this.drainResolver = null;
          resolve();
        }
      };
    });
  }

  private async reestablish(): Promise<void> {
    if (this.reestablishing) return;
    if (!this.active || this.closed || this.shuttingDown) return;
    this.reestablishing = true;
    try {
      const channel = await this.conn.createChannel();
      const publishChannel = await this.conn.createConfirmChannel();
      this.channel = channel;
      this.publishChannel = publishChannel;
      await this.assertTopology(channel, this.active.options);
      await channel.prefetch(this.active.options.prefetch ?? DEFAULT_PREFETCH);
      const { consumerTag } = await channel.consume(
        this.active.options.queue,
        (msg) => {
          void this.handleMessage(msg);
        },
        { noAck: false },
      );
      this.active.consumeTag = consumerTag;

      // Stale in-flight handlers' acks on the dead channel will no-op;
      // broker will redeliver. Clear so shutdown drain can complete.
      this.inFlight.clear();
      if (this.drainResolver) this.drainResolver();
    } catch {
      // Next reconnect will retry; swallow
    } finally {
      this.reestablishing = false;
    }
  }

  private async assertTopology(channel: Channel, options: ConsumerOptions): Promise<void> {
    const { exchange, queue, routingKey } = options;
    const dlqName = `${queue}.dlq`;

    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertExchange(DLX, 'topic', { durable: true });
    await channel.assertQueue(queue, {
      durable: true,
      exclusive: false,
      autoDelete: false,
    });
    await channel.assertQueue(dlqName, {
      durable: true,
      exclusive: false,
      autoDelete: false,
    });
    await channel.bindQueue(queue, exchange, routingKey);
    await channel.bindQueue(dlqName, DLX, routingKey);
  }

  private async handleMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;
    if (!this.active || !this.channel) return;

    const token = Symbol('inFlight');
    this.inFlight.add(token);

    try {
      const { options, handler } = this.active;
      const rawHeaders = (msg.properties.headers ?? {}) as Record<string, unknown>;
      const attempt = this.parseAttempt(rawHeaders);
      const firstError =
        typeof rawHeaders['x-bms-first-error'] === 'string' ? (rawHeaders['x-bms-first-error'] as string) : undefined;

      let payload: unknown;
      try {
        payload = JSON.parse(msg.content.toString('utf8'));
      } catch (err) {
        await this.publishParseFailureToDlq(msg, err);
        this.safeAck(msg);
        return;
      }

      const ctx: MessageContext = {
        attempt,
        headers: coerceHeaders(rawHeaders),
        routingKey: msg.fields.routingKey,
        queue: options.queue,
      };

      let result: HandlerResult | void = undefined;
      let handlerError: unknown;
      try {
        result = await handler(payload, ctx);
      } catch (err) {
        handlerError = err;
      }

      if (handlerError !== undefined) {
        await this.retryOrDlq(msg, attempt, firstError, handlerError, options);
        return;
      }

      if (result === 'requeue') {
        this.safeNack(msg, true);
        return;
      }

      if (result === 'nack') {
        await this.retryOrDlq(msg, attempt, firstError, new Error('handler returned nack'), options);
        return;
      }

      this.safeAck(msg);
    } finally {
      this.inFlight.delete(token);
      if (this.drainResolver) this.drainResolver();
    }
  }

  private parseAttempt(headers: Record<string, unknown>): number {
    const raw = headers['x-bms-attempt'];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) return raw;
    if (typeof raw === 'string') {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 1) return n;
    }
    return 1;
  }

  private async retryOrDlq(
    msg: ConsumeMessage,
    attempt: number,
    firstError: string | undefined,
    error: unknown,
    options: ConsumerOptions,
  ): Promise<void> {
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    const errorMsg = errorToString(error);
    const preservedFirstError = firstError ?? errorMsg;

    if (attempt >= maxRetries) {
      await this.publishExhaustedToDlq(msg, attempt, preservedFirstError, errorMsg);
      this.safeAck(msg);
      return;
    }

    this.safeAck(msg);
    const delay = computeBackoffMs(
      attempt + 1,
      options.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS,
      options.backoffMaxMs ?? DEFAULT_BACKOFF_MAX_MS,
    );

    const timer = setTimeout(() => {
      this.inFlightTimers.delete(timer);
      if (this.drainResolver) this.drainResolver();
      if (this.closed || this.shuttingDown) return;
      void this.republishForRetry(msg, attempt + 1, preservedFirstError, errorMsg);
    }, delay);
    this.inFlightTimers.add(timer);
  }

  private async republishForRetry(
    msg: ConsumeMessage,
    nextAttempt: number,
    firstError: string,
    lastError: string,
  ): Promise<void> {
    if (!this.active || !this.publishChannel) return;
    const { options } = this.active;

    const headers: Record<string, unknown> = {
      ...(msg.properties.headers ?? {}),
      'x-bms-attempt': nextAttempt,
      'x-bms-first-error': firstError,
      'x-bms-last-error': lastError,
    };

    try {
      this.publishChannel.publish(options.exchange, msg.fields.routingKey, msg.content, {
        persistent: wasPersistent(msg),
        contentType: msg.properties.contentType ?? 'application/json',
        headers,
      });
      await this.publishChannel.waitForConfirms();
    } catch {
      // best-effort; msg was acked, so loss is possible here —
      // documented tradeoff of in-process retry vs retry-queue
    }
  }

  private async publishExhaustedToDlq(
    msg: ConsumeMessage,
    attempt: number,
    firstError: string,
    lastError: string,
  ): Promise<void> {
    if (!this.publishChannel) return;
    const headers: Record<string, unknown> = {
      ...(msg.properties.headers ?? {}),
      'x-bms-attempt': attempt,
      'x-bms-first-error': firstError,
      'x-bms-last-error': lastError,
    };

    this.publishChannel.publish(DLX, msg.fields.routingKey, msg.content, {
      persistent: wasPersistent(msg),
      contentType: msg.properties.contentType ?? 'application/json',
      headers,
    });
    await this.publishChannel.waitForConfirms();
  }

  private async publishParseFailureToDlq(msg: ConsumeMessage, parseError: unknown): Promise<void> {
    if (!this.publishChannel) return;
    const headers: Record<string, unknown> = {
      ...(msg.properties.headers ?? {}),
      'x-bms-parse-error': errorToString(parseError),
    };

    this.publishChannel.publish(DLX, msg.fields.routingKey, msg.content, {
      persistent: wasPersistent(msg),
      contentType: msg.properties.contentType ?? 'application/octet-stream',
      headers,
    });
    await this.publishChannel.waitForConfirms();
  }

  private safeAck(msg: ConsumeMessage): void {
    if (!this.channel) return;
    try {
      this.channel.ack(msg);
    } catch {
      // channel torn down; broker will redeliver
    }
  }

  private safeNack(msg: ConsumeMessage, requeue: boolean): void {
    if (!this.channel) return;
    try {
      this.channel.nack(msg, false, requeue);
    } catch {
      // channel torn down; broker will redeliver
    }
  }
}

function coerceHeaders(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = coerceValue(v);
  }
  return out;
}

function coerceValue(v: unknown): unknown {
  if (Buffer.isBuffer(v)) return v.toString('utf8');
  if (Array.isArray(v)) return v.map(coerceValue);
  return v;
}

function errorToString(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function wasPersistent(msg: ConsumeMessage): boolean {
  // AMQP deliveryMode: 2 = persistent, 1 or undefined = volatile.
  // Preserving the original intent so retry/DLQ doesn't silently
  // promote volatile messages to durable.
  return msg.properties.deliveryMode === 2;
}
