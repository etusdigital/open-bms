export interface PushWebhook {
  platform: PlatformType.WEBPUSH | PlatformType.MOBILEPUSH;
  payload: PushPayload | PushPayload[];
  client_info: PushClient;
  timestamp?: number;
}

export interface PushPayload {
  uuid: string;
  timestamp: number;
  device_id: string;
  event: string;
  account: number;
  messageType: string;
  contactId: number;
  message?: number;
  campaign_type?: string;
  campaign?: number;
  automation?: number;
  automationType?: string;
  type?: string;
  utm_campaign?: string;
  url?: string;
}

export interface PushClient {
  EVENT_IP: string;
  EVENT_ORIGIN: string;
  EVENT_FAMILY: string;
}

export enum PushEventTypes {
  DELIVERED = 'delivered',
  BOUNCE = 'bounce',
  CLICK = 'click',
  CLOSE = 'close',
  SENT = 'sent',
}

export enum PlatformType {
  SENDGRID = 'sendgrid',
  SPARKPOST = 'sparkpost',
  TWILIO = 'twilio',
  WEBPUSH = 'web-push',
  MOBILEPUSH = 'mobile-push',
  CUSTOMEVENTS = 'custom_events',
  INTERNALEVENTS = 'internal',
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
}
