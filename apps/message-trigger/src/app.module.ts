import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from './providers/redis/redis.module';

import { AppController } from './app.controller';
import { InternalTriggerController } from './internal-trigger.controller';
import { AppService } from './app.service';
import { MessageTriggerConsumerService } from './message-trigger-consumer.service';
import { FormatterUtils } from './utils/formatter.utils';
import { ActiveStepsHandler } from './handlers/activesteps.handler';
import { ConditionStep } from './steps/condition.step';
import { TrackerModule } from './tracker/tracker.module';
import { MsgopsModule } from './msgops/msgops.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailValidationProvider } from './providers/emailValidation.provider';
import { typeOrmConfig } from './ormconfig';
import { HttpRequestProvider } from './providers/httpRequest.provider';
import { ActiveCampaignProvider } from './providers/activeCampaign.provider';
import {
  QueuePublisher,
  QUEUE_MESSAGE_TRIGGER,
  QUEUE_TIMER,
  QUEUE_CONDITION,
  QUEUE_SEND_EMAIL,
  QUEUE_SEND_PUSH,
  QUEUE_SEND_TWILIO,
  QUEUE_SEND_WHATSAPP,
  QUEUE_HTTP_REQUEST,
  QUEUE_TAG_PROCESS,
  QUEUE_EVENT_PROCESS,
} from './providers/queue/queue.publisher';
import { MessageTriggerProcessor, TimerProcessor, ConditionProcessor } from './providers/queue/processors';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot(typeOrmConfig),
    RedisModule,
    MsgopsModule,
    TrackerModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_MESSAGE_TRIGGER },
      { name: QUEUE_TIMER },
      { name: QUEUE_CONDITION },
      { name: QUEUE_SEND_EMAIL },
      { name: QUEUE_SEND_PUSH },
      { name: QUEUE_SEND_TWILIO },
      { name: QUEUE_SEND_WHATSAPP },
      { name: QUEUE_HTTP_REQUEST },
      { name: QUEUE_TAG_PROCESS },
      { name: QUEUE_EVENT_PROCESS },
    ),
  ],
  controllers: [AppController, InternalTriggerController],
  providers: [
    AppService,
    ActiveStepsHandler,
    QueuePublisher,
    ConditionStep,
    FormatterUtils,
    EmailValidationProvider,
    HttpRequestProvider,
    ActiveCampaignProvider,
    MessageTriggerProcessor,
    TimerProcessor,
    ConditionProcessor,
    MessageTriggerConsumerService,
  ],
})
export class AppModule {}
