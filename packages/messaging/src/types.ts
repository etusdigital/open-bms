export type HandlerResult = 'ack' | 'nack' | 'requeue';

export interface PublishOptions {
  exchange: string;
  routingKey: string;
  payload: unknown;
  headers?: Record<string, string | number>;
  persistent?: boolean;
}

export interface ConsumerOptions {
  exchange: string;
  routingKey: string;
  queue: string;
  prefetch?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
}

export interface MessageContext {
  attempt: number;
  headers: Record<string, unknown>;
  routingKey: string;
  queue: string;
}

export type Handler<T = unknown> = (
  msg: T,
  ctx: MessageContext,
) => Promise<HandlerResult | void>;

export interface Publisher {
  publish(options: PublishOptions): Promise<void>;
  close(): Promise<void>;
}

export interface Consumer {
  consume<T>(options: ConsumerOptions, handler: Handler<T>): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ConnectionOptions {
  url: string;
  heartbeatSec?: number;
}
