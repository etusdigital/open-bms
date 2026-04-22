import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { MsgopsEvent, TrackerParams, TrackerRequest } from './tracker.interface';

@Injectable()
export class TrackerService {
  uri: string;
  logLevel: string;

  constructor(private httpService: HttpService) {
    this.logLevel = process.env.LOG_LEVEL || null;
    this.uri = process.env.PIXEL_EVENT_STORE_URL || '';
  }

  getParameters(event: MsgopsEvent, params: TrackerRequest, started_at: number): TrackerParams {
    const parameters = {
      ...params,
      cloud_run: process.env.CLOUD_RUN || 'local',
      PORT: process.env.PORT || 'local',
      k_revision: process.env.K_REVISION || 'local',
      k_configuration: process.env.K_CONFIGURATION || 'local',
      started_at,
      event,
      event_time: Date.now(),
    };

    return parameters;
  }

  getKey(email: string, automationName: string, startedAt: number) {
    return `${email}:${automationName}:${startedAt}`;
  }

  getPixel(publisher: string, tracker_key: string, params: TrackerParams, uri: string) {
    let pixel = uri;

    pixel += `&publisher=${publisher}`;
    pixel += `&tracker_key=${tracker_key}`;
    pixel += `&event=${params.event}`;
    pixel += `&event_time=${params.event_time}`;
    pixel += `&automation_name=${params.automation_name}`;
    pixel += `&automation_type=${params.automation_type}`;
    pixel += `&email=${params.email}`;
    pixel += `&active_step=${params.active_step || ''}`;
    pixel += `&active_step_type=${params.active_step_type || ''}`;
    pixel += `&sengrid_response=${params.sengrid_response || ''}`;
    pixel += `&email_file=${params.email_file || ''}`;
    pixel += `&utm_campaign=${params.utm_campaign || ''}`;
    pixel += `&message_id=${params.message_id || ''}`;
    pixel += `&list_id=${params.list_id || ''}`;
    pixel += `&cloud_task_id=${params.cloud_task_id || ''}`;
    pixel += `&cloud_task_schedule_time=${params.cloud_task_schedule_time || ''}`;
    pixel += `&port=${params.PORT}`;
    pixel += `&k_revision=${params.k_revision}`;
    pixel += `&k_configuration=${params.k_configuration}`;

    return pixel;
  }

  send(event: MsgopsEvent, params: TrackerRequest, started_at: number) {
    if (['INFO', 'DEBUG'].includes(this.logLevel) === false) {
      return;
    }
    const startedAt = started_at || Date.now();
    const formattedParams = this.getParameters(event, params, startedAt);
    const key = this.getKey(params.email, params.automation_name, startedAt);

    console.log(`TrackerService: ${JSON.stringify({ key, ...formattedParams })}`);
  }

  sendPixel(publisher: string, key: string, trackerParams: TrackerParams) {
    const url = this.getPixel(publisher, key, trackerParams, this.uri);

    this.httpService.get(url).subscribe({
      next(x) {
        console.log('Tracker Service: read' + x);
      },
      error(err) {
        console.error(`Tracker Service: something wrong occurred: ${url}` + err);
      },
      complete() {
        console.log('Tracker Service: done');
      },
    });
  }

  log(title: string, text: any): void {
    if (['INFO', 'DEBUG'].includes(this.logLevel) === false) {
      return;
    }

    if (typeof text === 'object') {
      console.log(`${title}: `, JSON.stringify(text));
      return;
    }

    console.log(`${title}: `, text);
  }
}
