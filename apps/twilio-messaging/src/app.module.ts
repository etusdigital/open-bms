import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { Utils } from './utils/index.utils';
import { PubSubProvider } from './providers/pubsub.provider';
import { MsgopsModule } from './msgops/msgops.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from './providers/redis/redis.module';
import { typeOrmConfig } from './ormconfig';

@Module({
  imports: [ConfigModule.forRoot(), TypeOrmModule.forRoot(typeOrmConfig), MsgopsModule, RedisModule],
  controllers: [AppController],
  providers: [AppService, PubSubProvider, Utils],
})
export class AppModule {}
