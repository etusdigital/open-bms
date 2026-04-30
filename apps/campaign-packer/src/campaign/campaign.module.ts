import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FormatterUtils } from 'src/utils/formatter.utils';
import { CampaignService } from './campaign.service';
import { MsgopsModule } from '../msgops/msgops.module';
import { RedisModule } from '../providers/redis/redis.module';
import { QueueModule } from '../providers/queue/queue.module';

@Module({
  imports: [HttpModule, MsgopsModule, RedisModule, QueueModule],
  providers: [CampaignService, FormatterUtils],
  exports: [CampaignService],
})
export class CampaignModule {}
