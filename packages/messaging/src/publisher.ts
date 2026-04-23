import type { ConfirmChannel } from 'amqplib';
import { AmqpConnection, type RetryConfig } from './connection';
import { DLX } from './exchanges';
import type { ConnectionOptions, PublishOptions, Publisher } from './types';

export class PublisherClosedError extends Error {
  constructor() {
    super('AmqpPublisher has been closed');
    this.name = 'PublisherClosedError';
  }
}

export class SerializationError extends Error {
  constructor(cause: unknown) {
    super(`Failed to serialize payload: ${String(cause)}`);
    this.name = 'SerializationError';
  }
}

export class AmqpPublisher implements Publisher {
  private readonly conn: AmqpConnection;
  private channel: ConfirmChannel | null = null;
  private channelPromise: Promise<ConfirmChannel> | null = null;
  private exchangeAssertions = new Map<string, Promise<void>>();
  private closed = false;

  constructor(opts: ConnectionOptions, retry?: RetryConfig) {
    this.conn = new AmqpConnection(opts, retry);
  }

  async publish(options: PublishOptions): Promise<void> {
    if (this.closed) throw new PublisherClosedError();

    const body = this.serialize(options.payload);
    const channel = await this.getChannel();

    await this.assertExchange(channel, DLX);
    await this.assertExchange(channel, options.exchange);

    channel.publish(options.exchange, options.routingKey, body, {
      persistent: options.persistent ?? true,
      contentType: 'application/json',
      headers: options.headers,
    });

    await channel.waitForConfirms();
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    const channel = this.channel;
    this.channel = null;
    this.channelPromise = null;
    this.exchangeAssertions = new Map();

    if (channel) {
      try {
        await channel.close();
      } catch {
        // closing a broken channel is expected to throw; swallow
      }
    }

    await this.conn.close();
  }

  private serialize(payload: unknown): Buffer {
    try {
      const json = JSON.stringify(payload);
      if (typeof json !== 'string') {
        throw new TypeError('payload is not JSON-serializable');
      }
      return Buffer.from(json, 'utf8');
    } catch (err) {
      throw new SerializationError(err);
    }
  }

  private async getChannel(): Promise<ConfirmChannel> {
    if (this.channel) return this.channel;
    if (this.channelPromise) return this.channelPromise;

    this.channelPromise = this.createChannel();
    try {
      this.channel = await this.channelPromise;
      return this.channel;
    } finally {
      this.channelPromise = null;
    }
  }

  private async createChannel(): Promise<ConfirmChannel> {
    const channel = await this.conn.createConfirmChannel();
    const handleChannelLoss = () => {
      if (this.channel === channel) {
        this.channel = null;
        this.exchangeAssertions = new Map();
      }
    };
    channel.on('close', handleChannelLoss);
    channel.on('error', handleChannelLoss);
    return channel;
  }

  private assertExchange(channel: ConfirmChannel, exchange: string): Promise<void> {
    let p = this.exchangeAssertions.get(exchange);
    if (!p) {
      p = channel.assertExchange(exchange, 'topic', { durable: true }).then(() => undefined);
      this.exchangeAssertions.set(exchange, p);
    }
    return p;
  }
}
