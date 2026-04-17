import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { MsgopsModule } from './msgops/msgops.module';
import { PubSubProvider } from './providers/pubsub.provider';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './ormconfig';
import { Utils } from './utils';

@Module({
  imports: [ConfigModule.forRoot(), MsgopsModule, TypeOrmModule.forRoot(typeOrmConfig)],
  controllers: [AppController],
  providers: [AppService, PubSubProvider, Utils],
})
export class AppModule {}
