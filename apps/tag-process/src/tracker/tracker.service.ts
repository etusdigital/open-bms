import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { MsgopsEvent, TrackerParams, TrackerRequest } from './tracker.interface';

@Injectable()
export class TrackerService {
  uri: string;
  logLevel: string;

  constructor(private httpService: HttpService) {
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
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

  getKey(email: string, workflowname: string, startedAt: number) {
    return `${email}:${workflowname}:${startedAt}`;
  }

  getPixel(publisher: string, tracker_key: string, params: TrackerParams, uri: string) {
    let pixel = uri;

    pixel += `&publisher=${publisher}`;
    pixel += `&tracker_key=${tracker_key}`;
    pixel += `&event=${params.event}`;
    pixel += `&event_time=${params.event_time}`;
    pixel += `&workflow_name=${params.workflow_name}`;
    pixel += `&workflow_type=${params.workflow_type}`;
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
    const startedAt = started_at || Date.now();
    const formattedParams = this.getParameters(event, params, startedAt);
    const key = this.getKey(params.email, params.workflow_name, startedAt);

    this.logInfo(`TrackerService: ${JSON.stringify({ key, ...formattedParams })}`);
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

  logInfo(dsc: string, args?: string) {
    if (this.logLevel === 'INFO' || this.logLevel === 'DEBUG') console.log(dsc, args || '');
    else return;
  }
}
