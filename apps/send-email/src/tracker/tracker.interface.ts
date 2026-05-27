export enum MsgopsEvent {
  MSGOPS_LEAD_ENTRY = 'MSGOPS_LEAD_ENTRY',
  MSGOPS_RECEIVED_LEAD = 'MSGOPS_RECEIVED_LEAD',
  MSGOPS_STARTED_ACTIVE_STEP = 'MSGOPS_STARTED_ACTIVE_STEP',
  MSGOPS_CREATED_CLOUD_TASK = 'MSGOPS_CREATED_CLOUD_TASK',
  MSGOPS_SEND_EMAIL = 'MSGOPS_SEND_EMAIL',
  MSGOPS_SENDGRID_RESPONSE = 'MSGOPS_SENDGRID_RESPONSE',
  MSGOPS_SPARKPOST_RESPONSE = 'MSGOPS_SPARKPOST_RESPONSE',
}

export interface TrackerRequest {
  email: string;
  message_id?: string;
  list_id?: string;
  automation_name: string;
  automation_type: string;
  active_step?: string;
  active_step_type?: string;
  sengrid_response?: string;
  sparkpost_response?: string;
  email_file?: string;
  utm_campaign?: string;
  cloud_task_id?: string;
  cloud_task_schedule_time?: string;
}

export interface TrackerCloudRunParams {
  cloud_run: string;
  PORT: string;
  k_revision: string;
  k_configuration: string;
}

export interface TrackerParams extends TrackerRequest, TrackerCloudRunParams {
  started_at: number;
  event: MsgopsEvent;
  event_time: number;
}
