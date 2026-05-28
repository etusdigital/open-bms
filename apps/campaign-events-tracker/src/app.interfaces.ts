export interface EventTracker {
  campaign_id: number;
  service: MsgopsServices;
  event: MsgopsCampaignEvent;
  timestamp: number;
  audiences?: string[];
  contacts_length?: number;
  packages_length?: number;
  package_id?: string;
  email_id?: string;
  email_subject?: string;
  cloud_run: string;
  port: string;
  k_revision: string;
  k_configuration: string;
  data: any;
  page?: number;
  totalPages?: number;
  testabMode?: boolean;
}

export enum MsgopsCampaignEvent {
  CAMPAIGN_PROCESSING_STARTED = 'CAMPAIGN_PROCESSING_STARTED',
  SENT_EMAIL_BATCH = 'SENT_EMAIL_BATCH',
  SENT_PUSH_BATCH = 'SENT_PUSH_BATCH',
  SENT_WHATSAPP_BATCH = 'SENT_WHATSAPP_BATCH',
  SENT_SMS_BATCH = 'SENT_SMS_BATCH',
}

export enum MsgopsServices {
  MSGOPS_FRONTEND = 'MSGOPS_FRONTEND',
  MSGOPS_BACKEND = 'MSGOPS_BACKEND',
  MSGOPS_CAMPAIGN_TRIGGER = 'MSGOPS_CAMPAIGN_TRIGGER',
  MSGOPS_CAMPAIGN_PACKER = 'MSGOPS_CAMPAIGN_PACKER',
  MSGOPS_CAMPAIGN_BATCH_PROCESS = 'MSGOPS_CAMPAIGN_BATCH_PROCESS',
  MSGOPS_SEND_BATCH_EMAIL = 'MSGOPS_SEND_BATCH_EMAIL',
  MSGOPS_SEND_BATCH_PUSH = 'MSGOPS_SEND_BATCH_PUSH',
  MSGOPS_SEND_BATCH_TWILIO = 'MSGOPS_SEND_BATCH_TWILIO',
  // send-whatsapp publishes its tracker payload with this service value
  // (apps/send-whatsapp/src/app.service.ts:246). Without it the tracker
  // rejects every WhatsApp batch event with HTTP 400, the AMQP bridge
  // ACKs the 4xx silently, and the campaign row stays at sent_contacts=NULL
  // forever — even though the messages were actually sent to Meta.
  MSGOPS_SEND_BATCH_WHATSAPP = 'MSGOPS_SEND_BATCH_WHATSAPP',
}

export enum StatusCampaignEnum {
  SCHEDULED = 1,
  SENDING = 2,
  SENDING_TEST_AB = 6,
  PAUSED = 3,
  STOPPED = 4,
  COMPLETED = 5,
}

export enum CampaignsType {
  SIMPLE = 'simple',
  TESTAB = 'testAB',
  SPLIT = 'split',
  RECURRING = 'recurring',
}

export interface CampaignRecurrenceSettings {
  date: Date;
  interval: number;
  frequency: number;
  weekDays: number[];
  hasExpiration: boolean;
  untilDate: Date;
  untilSend: number;
  firstSentDate?: Date;
  lastSentDate?: Date;
}

export enum CampaignRecurrenceFrequency {
  daily = 1,
  weekly = 2,
  monthly = 3,
}

// Google Pub/Sub Interfaces

export interface SubscriptionMessage {
  message: Message;
  subscription: string;
}
interface Message {
  attributes: Attributes;
  data: string;
  messageId: string;
  message_id: string;
  publishTime: string;
  publish_time: string;
}

interface Attributes {
  key: string;
}
