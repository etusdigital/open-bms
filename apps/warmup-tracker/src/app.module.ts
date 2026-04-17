import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SlackService } from './services/slack.service';
import { typeOrmConfig } from './ormconfig';
import { WarmupUserEntity } from './entities/warmup-user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [ConfigModule.forRoot(), TypeOrmModule.forRoot(typeOrmConfig), TypeOrmModule.forFeature([WarmupUserEntity])],
  controllers: [AppController],
  providers: [AppService, SlackService],
})
export class AppModule {}
