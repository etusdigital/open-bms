import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PubSubProvider } from './providers/pubsub.provider';
import { GoogleTasksProvider } from './providers/google-tasks.provider';
import { AutomationHandler } from './handlers/automation.handler';
import { TrackerModule } from './tracker/tracker.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MsgopsModule } from './msgops/msgops.module';
import { LoggingProvider } from './providers/logging.provider';
import { FormatterUtils } from './utils/formatter.utils';
import { RedisModule } from './providers/redis/redis.module';
import { typeOrmConfig } from './ormconfig';

@Module({
  imports: [TrackerModule, MsgopsModule, ConfigModule.forRoot(), TypeOrmModule.forRoot(typeOrmConfig), RedisModule],
  controllers: [AppController],
  providers: [AppService, PubSubProvider, AutomationHandler, FormatterUtils, GoogleTasksProvider, LoggingProvider],
})
export class AppModule {}
