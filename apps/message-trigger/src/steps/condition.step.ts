import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

import { Injectable } from '@nestjs/common';
import { QueuePublisher } from '../providers/queue/queue.publisher';
import { CompressedPayload, LeadStateMessage, Next } from '../interfaces';
import { TrackerService } from '../tracker/tracker.service';
import { MsgopsEvent } from '../tracker/tracker.interface';

@Injectable()
export class ConditionStep {
  constructor(
    private readonly queuePublisher: QueuePublisher,
    private readonly trackerService: TrackerService,
  ) {}

  private async processNextStep(next: Next, compressPayload: CompressedPayload) {
    return this.queuePublisher.sendAsyncMessage(next.pubName, next.data, compressPayload);
  }

  private getTaskBodyToRepeatProcess(nextLeadStateMessage: LeadStateMessage, step: any, currentValue: number, timezone: string): { waitFor: number } {
    const {
      settings: { initialTime, endTime },
    } = step;
    let waitFor = 0;

    if (currentValue < initialTime) {
      waitFor = (initialTime - currentValue) * 60;
    }

    if (currentValue > endTime) {
      const currentDate = dayjs().tz(timezone);
      const nextDayHour = currentDate.add(1, 'day').hour(initialTime);
      const timeDifference = nextDayHour.diff(currentDate, 'hour', true);
      waitFor = Math.ceil(timeDifference) * 60;
    }

    return { waitFor: Number(waitFor) };
  }

  private async processRepeatStep(leadStateMessage: LeadStateMessage, step: any, currentValue: number, next: Next, timezone: string) {
    const { waitFor } = this.getTaskBodyToRepeatProcess(next.data, step, currentValue, timezone);
    return this.queuePublisher.scheduleDelayedStep(next.data, waitFor, step.type);
  }

  async processConditionalTime(messageId: string, leadStateMessage: LeadStateMessage, next: Next, step: any, compressPayload: CompressedPayload) {
    const {
      settings: { initialTime, endTime },
    } = step;

    const timezone = leadStateMessage.account?.accountConfigs?.time_zone || 'America/Sao_Paulo';
    const currentValue = dayjs().tz(timezone).hour();

    if (initialTime <= currentValue && endTime >= currentValue ? true : false) {
      return await this.processNextStep(next, compressPayload);
    }

    const job = await this.processRepeatStep(leadStateMessage, step, currentValue, next, timezone);

    this.trackerService.send(
      MsgopsEvent.MSGOPS_CREATED_CLOUD_TASK,
      {
        automation_name: leadStateMessage.automation.title,
        automation_type: leadStateMessage.automation.type,
        automation_version: leadStateMessage.automation.version || '-',
        email: leadStateMessage.contact.email,
        active_step: leadStateMessage.activeStepId,
        active_step_type: step.type,
        message_id: messageId,
        cloud_task_id: String(job.id),
      },
      leadStateMessage.startedAt,
    );

    return String(job.id);
  }
}
