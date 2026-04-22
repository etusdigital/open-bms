import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { ContactsModule } from '../contacts/contacts.module';
import { AccountsModule } from '../accounts/accounts.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountUsageEntity } from 'src/entities/account-usage.entity';
import { EventStatisticsEntity } from 'src/entities/event-statistics.entity';
import { GoogleTasksProvider } from 'src/providers/google-tasks.provider';
import { PoolsModule } from '../pools/pools.module';
import { MessagesModule } from '../messages/messages.module';
import { CampaignModule } from '../campaigns/campaigns.module';
import { AutomationsModule } from '../automations/automations.module';
import { StatisticsAggregationService } from './statistics.aggregation';
import { VerifyStatisticsEntity } from 'src/entities/verify-statistics.entity';
import { ClickhouseProvider } from 'src/providers/clickhouse.provider';

@Module({
  imports: [
    HttpModule,
    AccountsModule,
    MessagesModule,
    AutomationsModule,
    CampaignModule,
    ContactsModule,
    PoolsModule,
    TypeOrmModule.forFeature([AccountUsageEntity, EventStatisticsEntity, VerifyStatisticsEntity]),
  ],
  controllers: [StatisticsController],
  providers: [GoogleTasksProvider, StatisticsService, StatisticsAggregationService, ClickhouseProvider],
  exports: [StatisticsService],
})
export class StatisticsModule {}
