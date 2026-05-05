import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CampaignModule } from './campaign/campaign.module';
import { FormatterUtils } from './utils/formatter.utils';
import { MsgopsModule } from './msgops/msgops.module';
import { HttpModule } from '@nestjs/axios';
import { QueueModule } from './providers/queue/queue.module';
import { CampaignPackerProcessor } from './providers/queue/campaign-packer.processor';
import { SchedulePageProcessor } from './providers/queue/schedule-page.processor';
import { CampaignTriggerProcessor } from './providers/queue/campaign-trigger.processor';
import { MessagingModule } from './providers/messaging/messaging.module';

@Module({
  imports: [MessagingModule, CampaignModule, MsgopsModule, ConfigModule.forRoot({ isGlobal: true }), HttpModule, QueueModule],
  controllers: [AppController],
  providers: [AppService, FormatterUtils, CampaignPackerProcessor, SchedulePageProcessor, CampaignTriggerProcessor],
})
export class AppModule {}
