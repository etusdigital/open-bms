import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { FirebaseProvider } from './providers/firebase.provider';
import { Utils } from './utils/index.utils';
import { RedisModule } from './providers/redis/redis.module';
import { MessagingModule } from './messaging.module';
import { SendPushConsumerService } from './send-push-consumer.service';

@Module({
  imports: [ConfigModule.forRoot(), MessagingModule, RedisModule],
  controllers: [AppController],
  providers: [AppService, FirebaseProvider, SendPushConsumerService, Utils],
})
export class AppModule {}
