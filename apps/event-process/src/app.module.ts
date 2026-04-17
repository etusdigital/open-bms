import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { FormatterUtils } from './utils/formatter.utils';
import { Module } from '@nestjs/common';
import { MsgopsModule } from './msgops/msgops.module';
import { EventsModule } from './events/events.module';
import { CacheService } from './msgops/cache.service';

@Module({
  imports: [ConfigModule.forRoot(), MsgopsModule, EventsModule],
  controllers: [AppController],
  providers: [FormatterUtils, CacheService],
})
export class AppModule {}
