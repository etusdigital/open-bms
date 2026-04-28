import { Injectable } from '@nestjs/common';
import { AmqpConsumer, EXCHANGES } from '@bms/messaging';
import { AppService } from '../app.service';

const SHUTDOWN_TIMEOUT_MS = 10_000;

@Injectable()
export class LeadConsumerService {
  private readonly consumer: AmqpConsumer;

  constructor(private readonly appService: AppService) {
    if (!process.env.AMQP_URL) {
      throw new Error('AMQP_URL environment variable is required');
    }
    this.consumer = new AmqpConsumer({ url: process.env.AMQP_URL }, SHUTDOWN_TIMEOUT_MS);
  }

  async start(): Promise<void> {
    await this.consumer.consume(
      {
        exchange: EXCHANGES.leads,
        routingKey: 'lead.received',
        queue: 'lead-conception.lead.received',
        maxRetries: 3,
      },
      async (payload: any, ctx) => {
        const isUpdate = String(ctx.headers?.type) === 'update';
        const result = await this.appService.createOrUpdate(payload, isUpdate);
        if (result?.status && result.status !== 200) return 'nack';
        return 'ack';
      },
    );
  }

  async stop(): Promise<void> {
    await this.consumer.shutdown();
  }
}
