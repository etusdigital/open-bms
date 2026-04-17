import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { FirebaseProvider } from './providers/firebase.provider';
import { Utils } from './utils/index.utils';
import { PubSubProvider } from './providers/pubsub.provider';
import { RedisModule } from './providers/redis/redis.module';

@Module({
  imports: [ConfigModule.forRoot(), RedisModule],
  controllers: [AppController],
  providers: [AppService, FirebaseProvider, PubSubProvider, Utils],
})
export class AppModule {}
