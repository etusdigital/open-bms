import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CampaignService } from '../../campaign/campaign.service';
import { QUEUE_CAMPAIGN_PACKER_WARMUP } from './queue.publisher';

@Processor(QUEUE_CAMPAIGN_PACKER_WARMUP)
export class WarmupStartProcessor extends WorkerHost {
  private readonly logger = new Logger(WarmupStartProcessor.name);

  constructor(private readonly campaignService: CampaignService) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { campaign, warmups } = job.data;
    this.logger.log(`Processing warmup-start job ${job.id} for campaign ${campaign?.id}`);
    return this.campaignService.warmupStart(campaign, warmups);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${err.message}`, err.stack);
  }
}
