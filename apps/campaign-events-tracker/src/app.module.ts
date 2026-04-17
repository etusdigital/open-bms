import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FormatterUtils } from './utils/formatter.utils';
import { MsgopsModule } from './msgops/msgops.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './ormconfig';
import { RedisModule } from './providers/redis/redis.module';

@Module({
  imports: [MsgopsModule, TypeOrmModule.forRoot(typeOrmConfig), ConfigModule.forRoot(), RedisModule],
  controllers: [AppController],
  providers: [AppService, FormatterUtils],
})
export class AppModule {}
