import { Injectable } from '@nestjs/common';
import { MsgopsEvent, TrackerParams, TrackerRequest } from './tracker.interface';

@Injectable()
export class TrackerService {
  logLevel: string;

  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
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

  private send(event: MsgopsEvent, params: TrackerRequest, started_at: number, _publisher = 'plusdin') {
    const startedAt = started_at || Date.now();
    const formattedParams = this.getParameters(event, params, startedAt);
    const key = this.getKey(params.email, params.automation_name, startedAt);

    console.log(`TrackerService: ${JSON.stringify({ key, ...formattedParams })}`);
  }

  logInfo(dsc: string, args?: string) {
    if (this.logLevel === 'INFO' || this.logLevel === 'DEBUG') console.log(dsc, args || '');
    else return;
  }

  logDebug(dsc: string, args?: string) {
    if (this.logLevel === 'DEBUG') console.log(dsc, args || '');
    else return;
  }

  logError(dsc: string, args?: string) {
    console.log(dsc, args || '');
  }

  sendDebug(event: MsgopsEvent, params: TrackerRequest, started_at: number, publisher = 'plusdin') {
    if (this.logLevel === 'DEBUG') this.send(event, params, started_at, publisher);
    else return;
  }

  sendInfo(event: MsgopsEvent, params: TrackerRequest, started_at: number, publisher = 'plusdin') {
    if (this.logLevel === 'INFO' || this.logLevel === 'DEBUG') this.send(event, params, started_at, publisher);
    else return;
  }
}
