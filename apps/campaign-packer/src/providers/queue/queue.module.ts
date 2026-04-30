import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {
  QueuePublisher,
  QUEUE_CAMPAIGN_PACKER,
  QUEUE_CAMPAIGN_PACKER_WARMUP,
  QUEUE_CAMPAIGN_SCHEDULE_PAGE,
  QUEUE_CAMPAIGN_TRIGGER,
  QUEUE_CAMPAIGN_SEND_MESSAGE,
  QUEUE_CAMPAIGN_EVENTS_TRACKER,
  QUEUE_WARMUP_TRACKER,
} from './queue.publisher';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_CAMPAIGN_PACKER },
      { name: QUEUE_CAMPAIGN_PACKER_WARMUP },
      { name: QUEUE_CAMPAIGN_SCHEDULE_PAGE },
      { name: QUEUE_CAMPAIGN_TRIGGER },
      { name: QUEUE_CAMPAIGN_SEND_MESSAGE },
      { name: QUEUE_CAMPAIGN_EVENTS_TRACKER },
      { name: QUEUE_WARMUP_TRACKER },
    ),
  ],
  providers: [QueuePublisher],
  exports: [QueuePublisher, BullModule],
})
export class QueueModule {}
