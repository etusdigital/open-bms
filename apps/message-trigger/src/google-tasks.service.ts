import { Injectable } from '@nestjs/common';
import { env } from 'process';
import { CloudTasksClient } from '@google-cloud/tasks';
import { StepType } from './interfaces';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as crypto from 'crypto';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class GoogleTasksService {
  private client: CloudTasksClient;

  private project = env.GOOGLE_TASK_PROJECT;
  private location = env.GOOGLE_TASK_LOCATION;
  private queueTimer = env.GOOGLE_TASK_QUEUE_TIMER;
  private queueContidition = env.GOOGLE_TASK_QUEUE_CONDITION;
  private serviceAccountEmail = env.GOOGLE_CLIENT_EMAIL;
  private callbackURL = env.GOOGLE_TASK_CALLBACK_URL;

  constructor() {
    const options = {
      credentials: JSON.parse(env.SERVICE_ACCOUNT || '{}'),
    };

    this.client = new CloudTasksClient(options);
  }

  private configureParentClient(stepType: StepType) {
    const queue = stepType === StepType.CONDITIONAL_TIME ? this.queueContidition : this.queueTimer;

    const parent = this.client.queuePath(this.project, this.location, queue);

    return parent;
  }

  private calculateTimeStampScheduleTime(waitFor: number): number {
    const currentDate = dayjs().tz('America/Sao_Paulo');

    if (waitFor > 0) {
      return currentDate.add(waitFor, 'minute').unix();
    }

    return currentDate.unix();
  }

  private createTaskRequest(payload: string, waitFor: number, urlParams: string): { scheduleTime?: any; httpRequest: any } {
    if (!payload) throw new Error('Payload should be informed.');

    const requestBodyObject: { scheduleTime?: any; httpRequest: any } = {
      httpRequest: {
        httpMethod: 'POST',
        url: urlParams ? `${this.callbackURL}/?${urlParams}` : `${this.callbackURL}/`,
        oidcToken: {
          serviceAccountEmail: this.serviceAccountEmail,
        },
        body: Buffer.from(payload).toString('base64'),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    };

    if (waitFor && waitFor > 0) {
      requestBodyObject.scheduleTime = {
        seconds: this.calculateTimeStampScheduleTime(waitFor),
      };
    }

    return requestBodyObject;
  }

  async post({ payload, waitFor }: any, params: string, stepType: StepType) {
    if (process.env.NODE_ENV !== 'production') {
      return [{ name: crypto.randomBytes(20).toString('hex'), scheduleTime: { seconds: 100, nano: 10000 } }];
    }

    try {
      const parent = this.configureParentClient(stepType);
      const task = this.createTaskRequest(payload, waitFor, params);
      const request = { parent, task };

      return this.client.createTask(request);
    } catch (err) {
      throw new Error(`Failed to process and submit task to Google: ${err}`);
    }
  }
}
