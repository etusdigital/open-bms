import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

import { Injectable } from '@nestjs/common';
import { PubSubProvider } from '../providers/pubsub.provider';
import { GoogleTasksService } from '../google-tasks.service';
import { CompressedPayload, LeadStateMessage, Next } from '../interfaces';
import { TrackerService } from '../tracker/tracker.service';
import { MsgopsEvent } from '../tracker/tracker.interface';
import { google } from '@google-cloud/tasks/build/protos/protos';

@Injectable()
export class ConditionStep {
  constructor(
    private readonly pubSubProvider: PubSubProvider,
    private readonly googleTasksService: GoogleTasksService,
    private readonly trackerService: TrackerService,
  ) {}

  private async processNextStep(next: Next, compressPayload: CompressedPayload) {
    return this.pubSubProvider.sendAsyncMessage(next.pubName, next.data, compressPayload);
  }

  private getTaskBodyToRepeatProcess(nextLeadStateMessage: LeadStateMessage, step: any, currentValue: number, timezone: string): { payload: string; waitFor: number } {
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

    return {
      payload: JSON.stringify(nextLeadStateMessage),
      waitFor: Number(waitFor),
    };
  }

  private async processRepeatStep(leadStateMessage: LeadStateMessage, step: any, currentValue: number, next: Next, timezone: string) {
    const taskBody = this.getTaskBodyToRepeatProcess(next.data, step, currentValue, timezone);

    const urlParams = `automation_name=${leadStateMessage.automation.title}&active_step=${leadStateMessage.activeStepId}&email=${leadStateMessage.contact.email}&start_date=${leadStateMessage.startedAt}`;

    return await this.googleTasksService.post(taskBody, urlParams, step.type);
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

    const response = await this.processRepeatStep(leadStateMessage, step, currentValue, next, timezone);

    const [taskResponse] = response as [google.cloud.tasks.v2.ITask, google.cloud.tasks.v2.ICreateTaskRequest, object];
    const taskId = taskResponse?.name?.split('/').pop();

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
        cloud_task_id: taskId,
        cloud_task_schedule_time: taskResponse.scheduleTime.seconds.toString(),
      },
      leadStateMessage.startedAt,
    );

    return taskId;
  }
}
