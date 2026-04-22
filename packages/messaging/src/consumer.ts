import type {
  ConnectionOptions,
  Consumer,
  ConsumerOptions,
  Handler,
} from './types';

export class AmqpConsumer implements Consumer {
  constructor(private readonly connection: ConnectionOptions) {}

  async consume<T>(_options: ConsumerOptions, _handler: Handler<T>): Promise<void> {
    throw new Error('not implemented');
  }

  async shutdown(): Promise<void> {
    throw new Error('not implemented');
  }
}
