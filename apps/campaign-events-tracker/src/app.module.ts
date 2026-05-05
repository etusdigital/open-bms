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
import { CampaignEventsConsumerService } from './campaign-events-consumer.service';

@Module({
  imports: [MsgopsModule, TypeOrmModule.forRoot(typeOrmConfig), ConfigModule.forRoot(), RedisModule, QueueModule],
  controllers: [AppController],
  providers: [AppService, FormatterUtils, CampaignEventsConsumerService],
})
export class AppModule {}
