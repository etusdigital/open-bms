import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FormatterUtils } from './utils/formatter.utils';
import { MsgopsModule } from './msgops/msgops.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './ormconfig';
import { RedisModule } from './providers/redis/redis.module';
import { QueueModule } from './providers/queue/queue.module';
import { EventTrackerProcessor } from './providers/queue/event-tracker.processor';

@Module({
  imports: [MsgopsModule, TypeOrmModule.forRoot(typeOrmConfig), ConfigModule.forRoot(), RedisModule, QueueModule],
  controllers: [AppController],
  providers: [AppService, FormatterUtils, EventTrackerProcessor],
})
export class AppModule {}
