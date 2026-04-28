import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AppService } from '../../app.service';
import { QUEUE_SEGMENT_PROCESS } from './queue.publisher';

@Processor(QUEUE_SEGMENT_PROCESS)
export class SegmentProcessor extends WorkerHost {
  constructor(private readonly appService: AppService) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { segmentId } = job.data;
    return this.appService.processSegment(segmentId);
  }
}
