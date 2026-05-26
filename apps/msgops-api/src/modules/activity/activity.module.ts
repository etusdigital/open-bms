import { Module } from '@nestjs/common';
import { ClickhouseProvider } from '../../providers/clickhouse.provider';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

@Module({
  controllers: [ActivityController],
  providers: [ActivityService, ClickhouseProvider],
})
export class ActivityModule {}
