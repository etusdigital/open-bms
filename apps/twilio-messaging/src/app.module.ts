import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { Utils } from './utils/index.utils';
import { MessagingModule } from './messaging.module';
import { TwilioMessagingConsumerService } from './twilio-messaging-consumer.service';
import { MsgopsModule } from './msgops/msgops.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from './providers/redis/redis.module';
import { typeOrmConfig } from './ormconfig';

@Module({
  imports: [ConfigModule.forRoot(), MessagingModule, TypeOrmModule.forRoot(typeOrmConfig), MsgopsModule, RedisModule],
  controllers: [AppController],
  providers: [AppService, TwilioMessagingConsumerService, Utils],
})
export class AppModule {}
