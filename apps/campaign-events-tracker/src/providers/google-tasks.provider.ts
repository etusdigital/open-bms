import { Injectable } from '@nestjs/common';
import { env } from 'process';
import { CloudTasksClient, protos } from '@google-cloud/tasks';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import * as crypto from 'crypto';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class GoogleTasksProvider {
  private client: CloudTasksClient;
  private parent;

  private project = env.GOOGLE_TASKS_PROJECT_ID;
  private location = env.GOOGLE_TASKS_LOCATION;
  private serviceAccountEmail = env.GOOGLE_CLIENT_EMAIL;

  constructor() {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
    };

    this.client = new CloudTasksClient(options);
  }

  private configureClient(queue: string) {
    this.parent = this.client.queuePath(this.project, this.location, queue);
  }

  private calculateTimeStampScheduleTime(waitFor: number): number {
    const currentDate = dayjs().tz('America/Sao_Paulo');

    if (waitFor > 0) {
      return currentDate.add(waitFor, 'millisecond').unix();
    }

    return currentDate.unix();
  }

  private createTaskRequest(
    id: number | string,
    waitFor: number,
    baseUrl: string,
    body?: string,
  ): { scheduleTime?: any; httpRequest: any } {
    if (!id) {
      throw new Error('ID should be informed.');
    }

    const requestBodyObject: { scheduleTime?: any; httpRequest: any; dispatchDeadline?: any } = {
      httpRequest: {
        httpMethod: 'POST',
        url: `${baseUrl}/${id}`,
        oidcToken: {
          serviceAccountEmail: this.serviceAccountEmail,
        },
      },
      dispatchDeadline: protos.google.protobuf.Duration.create({ seconds: 1800 }),
    };

    if (body) {
      requestBodyObject.httpRequest.headers = {
        'Content-Type': 'application/json',
      };

      requestBodyObject.httpRequest.body = Buffer.from(body).toString('base64');
    }

    if (waitFor && waitFor > 0) {
      requestBodyObject.scheduleTime = {
        seconds: this.calculateTimeStampScheduleTime(waitFor),
      };
    }

    return requestBodyObject;
  }

  async create(id: number | string, scheduleTo: Date, baseUrl: string, queue: string, body?: string) {
    if (process.env.NODE_ENV !== 'production') {
      return [{ name: crypto.randomBytes(20).toString('hex') }];
    }

    this.configureClient(queue);
    const todayDate = dayjs().tz('America/Sao_Paulo');
    const scheduleToDate = dayjs(scheduleTo).tz('America/Sao_Paulo');
    const diffMillisecond = scheduleToDate.diff(todayDate, 'millisecond');

    try {
      const task = this.createTaskRequest(id, diffMillisecond, baseUrl, body);
      return this.client.createTask({ parent: this.parent, task: task });
    } catch (err) {
      throw new Error(`Failed to process and submit task to Google: ${err}`, { cause: err });
    }
  }

  async delete(name: string, queue: string) {
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }

    this.configureClient(queue);
    return this.client.deleteTask({ name });
  }

  async callRunTask(name: string, queue: string) {
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }

    this.configureClient(queue);
    return await this.client.runTask({ name });
  }
}
