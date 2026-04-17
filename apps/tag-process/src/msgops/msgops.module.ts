import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MsgopsService } from './msgops.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from './entities/account.entity';
import { AccountConfigEntity } from './entities/account-config.entity';
import { AutomationEntity } from './entities/automation.entity';
import { ContactAutomationEntity } from './entities/contact-automation.entity';
import { ContactEntity } from './entities/contact.entity';
import { ContactTagEntity } from './entities/contact-tag.entity';
import { TagEntity } from './entities/tag.entity';
import { RedisModule } from 'src/providers/redis/redis.module';
import { ContactDeviceEntity } from './entities/contact-device.entity';
import { LeadsEntity } from './entities/leads.entity';
import { ContactConditionalEntity } from './entities/contact-conditional.entity';
import { TrackerModule } from 'src/tracker/tracker.module';
import { AutomationTargetEntity } from './entities/automation-target-entity';
import { CampaignEntity } from './entities/campaign.entity';
import { ClickhouseProvider } from 'src/providers/clickhouse.provider';

@Module({
  imports: [
    ConfigModule.forRoot(),
    RedisModule,
    TypeOrmModule.forFeature([
      AccountEntity,
      AccountConfigEntity,
      AutomationEntity,
      TagEntity,
      ContactAutomationEntity,
      ContactTagEntity,
      ContactEntity,
      ContactDeviceEntity,
      LeadsEntity,
      ContactConditionalEntity,
      AutomationTargetEntity,
      CampaignEntity,
    ]),
    TrackerModule,
  ],
  exports: [MsgopsService],
  providers: [MsgopsService, ClickhouseProvider],
})
export class MsgopsModule {}
