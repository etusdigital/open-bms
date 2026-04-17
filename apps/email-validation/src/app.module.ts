import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './providers/redis/redis.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MsgopsModule } from './msgops/msgops.module';
import { CheckerProvider } from './providers/checker.provider';
import { typeOrmConfig } from './ormconfig';

@Module({
  imports: [ConfigModule.forRoot(), TypeOrmModule.forRoot(typeOrmConfig), RedisModule, MsgopsModule],
  controllers: [AppController],
  providers: [AppService, CheckerProvider],
})
export class AppModule {}
