import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { InternalAutomationController } from './internal-automation.controller';
import { AppService } from './app.service';
import { AutomationHandler } from './handlers/automation.handler';
import { TrackerModule } from './tracker/tracker.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MsgopsModule } from './msgops/msgops.module';
import { LoggingProvider } from './providers/logging.provider';
import { FormatterUtils } from './utils/formatter.utils';
import { RedisModule } from './providers/redis/redis.module';
import { typeOrmConfig } from './ormconfig';
import {
  QueuePublisher,
  QUEUE_MESSAGE_TRIGGER,
  QUEUE_ANALYTICS,
  QUEUE_SEGMENT_ANALYTICS,
  QUEUE_CONTACTS_BATCH,
  QUEUE_SEGMENT_PROCESS,
  QUEUE_TAG_PROCESS,
} from './providers/queue/queue.publisher';
import { SegmentProcessor } from './providers/queue/segment.processor';
import { TagProcessor } from './providers/queue/tag.processor';
import { TagProcessConsumerService } from './tag-process-consumer.service';

@Module({
  imports: [
    TrackerModule,
    MsgopsModule,
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot(typeOrmConfig),
    RedisModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_MESSAGE_TRIGGER },
      { name: QUEUE_ANALYTICS },
      { name: QUEUE_SEGMENT_ANALYTICS },
      { name: QUEUE_CONTACTS_BATCH },
      { name: QUEUE_SEGMENT_PROCESS },
      { name: QUEUE_TAG_PROCESS },
    ),
  ],
  controllers: [AppController, InternalAutomationController],
  providers: [
    AppService,
    QueuePublisher,
    AutomationHandler,
    FormatterUtils,
    SegmentProcessor,
    TagProcessor,
    LoggingProvider,
    TagProcessConsumerService,
  ],
})
export class AppModule {}
