import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { CampaignDto } from '../campaigns/campaign.dto';
import { BatchService } from './batch.service';
import { CronRoute } from '../authz/cron-route.decorator';

@Controller('batch')
export class BatchController {
  constructor(private readonly batchService: BatchService) {}
  @ApiOperation({
    summary: 'Create campaigns and messages in batch. The ids will be assigned at creation and a new campaigns with the updated values will be returned as a response.',
  })
  @CronRoute()
  @Post('campaigns-messages')
  async createCampaignsAndMessages(@Body() campaignDtos: CampaignDto[]): Promise<CampaignDto[]> {
    return await this.batchService.createCampaignsAndMessages(campaignDtos);
  }
}
