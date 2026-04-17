import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IpReputationDailyEntity } from 'src/entities/ip-reputation-daily.entity';
import { IpReputationController } from './ip-reputation.controller';
import { IpReputationService } from './ip-reputation.service';
import { ClickhouseProvider } from 'src/providers/clickhouse.provider';

@Module({
  imports: [TypeOrmModule.forFeature([IpReputationDailyEntity])],
  controllers: [IpReputationController],
  providers: [IpReputationService, ClickhouseProvider],
  exports: [IpReputationService],
})
export class IpReputationModule {}
