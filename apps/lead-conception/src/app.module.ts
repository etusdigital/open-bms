import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './providers/redis/redis.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FormatterUtils } from './utils/formatter.utils';
import { TagPublisherService } from './publishers/tag-publisher.service';
import { EventPublisherService } from './publishers/event-publisher.service';
import { TriggerPublisherService } from './publishers/trigger-publisher.service';
import { LeadConsumerService } from './consumers/lead-consumer.service';
import { MsgopsModule } from './msgops/msgops.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailValidationProvider } from './providers/emailValidation.provider';
import { typeOrmConfig } from './ormconfig';
import { GeolocationModule } from './geolocation/geolocation.module';
@Module({
  imports: [ConfigModule.forRoot(), TypeOrmModule.forRoot(typeOrmConfig), RedisModule, MsgopsModule, GeolocationModule],
  controllers: [AppController],
  providers: [AppService, EmailValidationProvider, FormatterUtils, TagPublisherService, EventPublisherService, TriggerPublisherService, LeadConsumerService],
})
export class AppModule {}
