import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueuePublisher, QUEUE_CAMPAIGN_TRIGGER } from './queue.publisher';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue({ name: QUEUE_CAMPAIGN_TRIGGER }),
  ],
  providers: [QueuePublisher],
  exports: [QueuePublisher, BullModule],
})
export class QueueModule {}
