import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { WarmupsService } from './warmups.service';
import { WarmupsController } from './warmups.controller';
import { RedisModule } from '../../providers/redis.provider';
import { WarmupEntity } from 'src/entities/warmup.entity';
import { CampaignModule } from '../campaigns/campaigns.module';
import { StatisticsModule } from '../statistics/statistics.module';

@Module({
  imports: [
    HttpModule,
    CampaignModule,
    StatisticsModule,
    TypeOrmModule.forFeature([AccountConfigEntity, WarmupEntity]),
    RedisModule.register({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
    }),
  ],
  controllers: [WarmupsController],
  providers: [WarmupsService],
  exports: [WarmupsService],
})
export class WarmupsModule {}
