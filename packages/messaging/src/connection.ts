import * as amqplib from 'amqplib';
import type { Channel, ChannelModel, ConfirmChannel } from 'amqplib';
import type { ConnectionOptions } from './types';
import { computeBackoffMs } from './retry';

export class ConnectionClosedError extends Error {
  constructor() {
    super('AmqpConnection has been closed');
    this.name = 'ConnectionClosedError';
  }
}

/**
 * Replace the password in an AMQP URL with `***`. Returns a synthetic
 * placeholder for unparseable input. Exposed for consumers that want to
 * build their own logs without leaking credentials.
 */
export function redactAmqpUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '[invalid amqp url]';
  }
}

async function connectRedacted(url: string): Promise<ChannelModel> {
  try {
    return await amqplib.connect(url);
  } catch (err) {
    throw wrapConnectError(url, err);
  }
}

function wrapConnectError(url: string, cause: unknown): Error {
  const redacted = redactAmqpUrl(url);
  const rawMsg = cause instanceof Error ? cause.message : String(cause);
  const scrubbedMsg = rawMsg.split(url).join(redacted);
  const wrapped = new Error(`AMQP connect to ${redacted} failed: ${scrubbedMsg}`);
  wrapped.name = 'AmqpConnectError';
  if (cause instanceof Error && cause.stack) {
    wrapped.stack = cause.stack.split(url).join(redacted);
  }
  return wrapped;
}

export interface RetryConfig {
  baseMs?: number;
  maxMs?: number;
  maxInitialRetries?: number;
}

interface ResolvedRetry {
  baseMs: number;
  maxMs: number;
  maxInitialRetries: number;
}

export class AmqpConnection {
  private conn: ChannelModel | null = null;
  private connPromise: Promise<ChannelModel> | null = null;
  private closed = false;
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectPending = false;
  private readonly listeners: Array<() => void> = [];
  private readonly retry: ResolvedRetry;

  constructor(
    private readonly opts: ConnectionOptions,
    retry: RetryConfig = {},
  ) {
    this.retry = {
      baseMs: retry.baseMs ?? 1000,
      maxMs: retry.maxMs ?? 30_000,
      maxInitialRetries: retry.maxInitialRetries ?? 5,
    };
  }

  async getConnection(): Promise<ChannelModel> {
    if (this.closed) throw new ConnectionClosedError();
    if (this.conn) return this.conn;
    if (this.connPromise) return this.connPromise;

    this.connPromise = this.connectWithInitialRetry();
    try {
      this.conn = await this.connPromise;
      return this.conn;
    } finally {
      this.connPromise = null;
    }
  }

  async createChannel(): Promise<Channel> {
    const conn = await this.getConnection();
    return conn.createChannel();
  }

  async createConfirmChannel(): Promise<ConfirmChannel> {
    const conn = await this.getConnection();
    return conn.createConfirmChannel();
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const conn = this.conn;
    this.conn = null;
    if (conn) {
      try {
        await conn.close();
      } catch {
        // closing a broken conn is expected to throw; swallow
      }
    }
  }

  onReconnect(cb: () => void): void {
    this.listeners.push(cb);
  }

  private async connectWithInitialRetry(): Promise<ChannelModel> {
    let lastError: unknown;
    for (let i = 0; i < this.retry.maxInitialRetries; i++) {
      try {
        const conn = await connectRedacted(this.opts.url);
        this.bindConnectionEvents(conn);
        this.reconnectAttempt = 0;
        return conn;
      } catch (err) {
        lastError = err;
        if (i < this.retry.maxInitialRetries - 1) {
          const delay = computeBackoffMs(i + 1, this.retry.baseMs, this.retry.maxMs);
          await sleep(delay);
        }
      }
    }
    throw lastError;
  }

  private bindConnectionEvents(conn: ChannelModel): void {
    let dispatched = false;
    const handleLoss = () => {
      if (dispatched) return;
      dispatched = true;
      if (this.conn === conn) {
        this.conn = null;
      }
      if (!this.closed) {
        this.scheduleReconnect();
      }
    };
    conn.on('close', handleLoss);
    conn.on('error', handleLoss);
  }

  private scheduleReconnect(): void {
    if (this.reconnectPending) return;
    this.reconnectPending = true;
    this.reconnectAttempt += 1;
    const delay = computeBackoffMs(this.reconnectAttempt, this.retry.baseMs, this.retry.maxMs);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectPending = false;
      if (this.closed) return;
      void this.attemptReconnect();
    }, delay);
  }

  private async attemptReconnect(): Promise<void> {
    try {
      const conn = await connectRedacted(this.opts.url);
      if (this.closed) {
        try {
          await conn.close();
        } catch {
          // we were closed mid-connect; swallow
        }
        return;
      }
      this.bindConnectionEvents(conn);
      this.conn = conn;
      this.reconnectAttempt = 0;
      this.fireReconnectListeners();
    } catch {
      if (!this.closed) {
        this.scheduleReconnect();
      }
    }
  }

  private fireReconnectListeners(): void {
    for (const cb of this.listeners) {
      try {
        cb();
      } catch {
        // continue with other listeners
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
