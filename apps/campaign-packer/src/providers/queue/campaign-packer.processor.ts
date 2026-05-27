import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CampaignService } from '../../campaign/campaign.service';
import { Campaign } from '../../interfaces';
import { QUEUE_CAMPAIGN_PACKER } from './queue.publisher';

@Processor(QUEUE_CAMPAIGN_PACKER)
export class CampaignPackerProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignPackerProcessor.name);

  constructor(private readonly campaignService: CampaignService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing campaign packer job ${job.id}`);
    return this.campaignService.createBatches(job.data as Campaign);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${err.message}`, err.stack);
  }
}
