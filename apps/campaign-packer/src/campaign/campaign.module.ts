import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FormatterUtils } from 'src/utils/formatter.utils';
import { CampaignService } from './campaign.service';
import { MsgopsModule } from '../msgops/msgops.module';
import { GoogleTasksService } from '../providers/google-tasks.service';
import { RedisModule } from '../providers/redis/redis.module';
import { PubSubProvider } from 'src/providers/pubsub.provider';

@Module({
  imports: [HttpModule, MsgopsModule, RedisModule],
  providers: [CampaignService, FormatterUtils, PubSubProvider, GoogleTasksService],
  exports: [CampaignService],
})
export class CampaignModule {}
