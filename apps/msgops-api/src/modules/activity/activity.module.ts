import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClickhouseProvider } from '../../providers/clickhouse.provider';
import { AccountEntity } from '../../entities/account.entity';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccountEntity])],
  controllers: [ActivityController],
  providers: [ActivityService, ClickhouseProvider],
})
export class ActivityModule {}
