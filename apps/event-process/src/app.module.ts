import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { FormatterUtils } from './utils/formatter.utils';
import { Module } from '@nestjs/common';
import { MsgopsModule } from './msgops/msgops.module';
import { EventsModule } from './events/events.module';
import { CacheService } from './msgops/cache.service';
import { EventProcessConsumerService } from './event-process-consumer.service';
import { MessagingModule } from './messaging.module';

@Module({
  imports: [ConfigModule.forRoot(), MessagingModule, MsgopsModule, EventsModule],
  controllers: [AppController],
  providers: [FormatterUtils, CacheService, EventProcessConsumerService],
})
export class AppModule {}
