import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CampaignService } from '../../campaign/campaign.service';
import { CampaignBatch } from '../../interfaces';
import { QUEUE_CAMPAIGN_SCHEDULE_PAGE } from './queue.publisher';

@Processor(QUEUE_CAMPAIGN_SCHEDULE_PAGE)
export class SchedulePageProcessor extends WorkerHost {
  private readonly logger = new Logger(SchedulePageProcessor.name);

  constructor(private readonly campaignService: CampaignService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing schedule-page job ${job.id}, page ${job.data?.page}`);
    return this.campaignService.processPage(job.data as CampaignBatch);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${err.message}`, err.stack);
  }
}
