import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AppService } from '../../app.service';
import { QUEUE_CONDITION, QUEUE_MESSAGE_TRIGGER, QUEUE_TIMER } from './queue.publisher';

@Processor(QUEUE_MESSAGE_TRIGGER)
export class MessageTriggerProcessor extends WorkerHost {
  constructor(private readonly appService: AppService) {
    super();
  }

  async process(job: Job): Promise<any> {
    return this.appService.receiveMessage(job.data, String(job.id), '');
  }
}

@Processor(QUEUE_TIMER)
export class TimerProcessor extends WorkerHost {
  constructor(private readonly appService: AppService) {
    super();
  }

  async process(job: Job): Promise<any> {
    return this.appService.receiveMessage(job.data, String(job.id), '');
  }
}

@Processor(QUEUE_CONDITION)
export class ConditionProcessor extends WorkerHost {
  constructor(private readonly appService: AppService) {
    super();
  }

  async process(job: Job): Promise<any> {
    return this.appService.receiveMessage(job.data, String(job.id), '');
  }
}
