import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AppService } from '../../app.service';
import { EventTracker } from '../../app.interfaces';
import { QUEUE_CAMPAIGN_EVENTS_TRACKER } from './queue.publisher';

@Processor(QUEUE_CAMPAIGN_EVENTS_TRACKER)
export class EventTrackerProcessor extends WorkerHost {
  private readonly logger = new Logger(EventTrackerProcessor.name);

  constructor(private readonly appService: AppService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing event-tracker job ${job.id}`);
    return this.appService.addEventTracker(job.data as EventTracker, null);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${err.message}`,
      err.stack,
    );
  }
}
