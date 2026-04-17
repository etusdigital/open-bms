import { Injectable } from '@nestjs/common';
import { env } from 'process';
import { CloudTasksClient } from '@google-cloud/tasks';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class GoogleTasksService {
  private cloudTasksClient: CloudTasksClient;

  private project = env.GOOGLE_TASK_PROJECT;
  private location = env.GOOGLE_TASK_LOCATION;
  private serviceAccountEmail = env.GOOGLE_CLIENT_EMAIL;

  constructor() {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
    };

    this.cloudTasksClient = new CloudTasksClient(options);
  }

  private calculateTimeStampScheduleTime(waitFor: number): number {
    const currentDate = dayjs().tz('America/Sao_Paulo');

    if (waitFor > 0) {
      return currentDate.add(waitFor, 'millisecond').unix();
    }

    return currentDate.unix();
  }

  private createTaskRequest(payload: string, waitFor: number, urlParams: string | number, callbackURL: string): { scheduleTime?: any; httpRequest: any } {
    if (!payload) throw new Error('Payload should be informed to create a Task.');

    const requestBodyObject: { scheduleTime?: any; httpRequest: any } = {
      httpRequest: {
        httpMethod: 'POST',
        url: urlParams ? `${callbackURL}?${urlParams}` : `${callbackURL}`,
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

  async getMillisecondDiff(scheduleTo: string) {
    const todayDate = dayjs().tz('America/Sao_Paulo');
    const scheduleToDate = dayjs(scheduleTo).tz('America/Sao_Paulo');
    return scheduleToDate.diff(todayDate, 'millisecond');
  }

  async post({ payload, waitFor }: any, params: string | number, taskQueue: string, callbackUrl: string) {
    try {
      const parent = this.cloudTasksClient.queuePath(this.project, this.location, taskQueue);

      const task = this.createTaskRequest(payload, waitFor, params, callbackUrl);
      const request = { parent, task };

      return this.cloudTasksClient.createTask(request);
    } catch (err) {
      throw new Error(`Failed to process and submit task to Google: ${err}`);
    }
  }
}
