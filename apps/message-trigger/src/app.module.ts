import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './providers/redis/redis.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FormatterUtils } from './utils/formatter.utils';
import { GoogleTasksService } from './google-tasks.service';
import { ActiveStepsHandler } from './handlers/activesteps.handler';
import { PubSubProvider } from './providers/pubsub.provider';
import { ConditionStep } from './steps/condition.step';
import { TrackerModule } from './tracker/tracker.module';
import { MsgopsModule } from './msgops/msgops.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailValidationProvider } from './providers/emailValidation.provider';
import { typeOrmConfig } from './ormconfig';
import { HttpRequestProvider } from './providers/httpRequest.provider';
import { ActiveCampaignProvider } from './providers/activeCampaign.provider';

@Module({
  imports: [ConfigModule.forRoot(), TypeOrmModule.forRoot(typeOrmConfig), RedisModule, MsgopsModule, TrackerModule],
  controllers: [AppController],
  providers: [
    AppService,
    ActiveStepsHandler,
    GoogleTasksService,
    PubSubProvider,
    ConditionStep,
    FormatterUtils,
    EmailValidationProvider,
    HttpRequestProvider,
    ActiveCampaignProvider,
  ],
})
export class AppModule {}
