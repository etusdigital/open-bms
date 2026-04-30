import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CampaignService } from '../../campaign/campaign.service';
import { QUEUE_CAMPAIGN_TRIGGER } from './queue.publisher';

@Processor(QUEUE_CAMPAIGN_TRIGGER)
export class CampaignTriggerProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignTriggerProcessor.name);

  constructor(private readonly campaignService: CampaignService) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { campaignId } = job.data;
    this.logger.log(`Processing campaign-trigger job ${job.id} for campaign ${campaignId}`);
    return this.campaignService.createContactsSend(campaignId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${err.message}`, err.stack);
  }
}
