import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AppService } from '../../app.service';
import { QUEUE_TAG_PROCESS } from './queue.publisher';

@Processor(QUEUE_TAG_PROCESS)
export class TagProcessor extends WorkerHost {
  private readonly logger = new Logger(TagProcessor.name);

  constructor(private readonly appService: AppService) {
    super();
  }

  async process(job: Job): Promise<any> {
    const data = job.data as any;
    switch (data.type) {
      case 'add':
        return this.appService.addTag(data);
      case 'remove':
        return this.appService.removeTag(data);
      case 'completed':
        return this.appService.processCompleted(data);
      default:
        this.logger.warn(`[tag-process] unknown job type=${JSON.stringify(data?.type)} jobId=${job.id}`);
        throw new Error(`Unknown tag-process job type: ${JSON.stringify(data?.type)}`);
    }
  }
}
