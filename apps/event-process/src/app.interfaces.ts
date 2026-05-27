import { PlatformType, PushEventTypes } from './events/interfaces/push.interfaces';
import { IncomingHttpHeaders } from 'http';

export interface SendgridPayload {
  email: string;
  timestamp: number;
  event: string;
  category: string[];
  sg_event_id: string;
  sg_message_id?: string;

  // Optional fields based on event type
  ip?: string;
  response?: string;
  attempt?: string;
  status?: string;
  reason?: string;
  type?: string;
  bounce_classification?: SendgridBounceClassification;
  sg_machine_open?: boolean;
  useragent?: string;
  url?: string;
  asm_group_id?: number;
  tls?: number;
  smtp_id?: string;

  // Click event specific fields
  url_offset?: {
    index: number;
    type: string;
  };
  unique_arg_key?: string;
  newsletter?: {
    newsletter_user_list_id: string;
    newsletter_id: string;
    newsletter_send_id: string;
  };

  // Batch related fields
  batch_page?: string;
  batch_schedule_to?: string;
  batch_spread?: string;

  // Custom fields
  accountId?: string;
  contactId?: number;
  uuid?: string;
  messageId?: string;
  sent_at?: string;
  eventId?: number;
}

export enum SendgridBounceClassification {
  INVALID_ADDRESS = 'Invalid Address',
  TECHNICAL = 'Technical',
  CONTENT = 'Content',
  REPUTATION = 'Reputation',
  FREQUENCY_VOLUME = 'Frequency/Volume',
  MAILBOX_UNAVAILABLE = 'Mailbox Unavailable',
  UNCLASSIFIED = 'Unclassified',
}

export interface SendgridEvent {
  payload: SendgridPayload[];
  platform: PlatformType.SENDGRID;
  account: string;
  events?: string;
}

export enum SendgridEventTypes {
  PROCESSED = 'processed',
  DELIVERED = 'delivered',
  CLICK = 'click',
  OPEN = 'open',
  BOUNCE = 'bounce',
  BLOCKED = 'blocked',
  UNSUBSCRIBE = 'unsubscribe',
  GROUPUNSUBSCRIBE = 'group_unsubscribe',
  GROUPRESUBSCRIBE = 'group_resubscribe',
  DROPPED = 'dropped',
  DEFERRED = 'deferred',
  SPAMREPORT = 'spamreport',
}

export enum TwillioEventTypes {
  READ = 'read',
  CLICK = 'click',
  QUEUED = 'queued',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
  DELIVERED = 'delivered',
  UNDELIVERED = 'undelivered',
  RECEIVING = 'receiving',
  RECEIVED = 'received',
  ACCEPTED = 'accepted',
  SCHEDULED = 'scheduled',
  CANCELED = 'canceled',
}

export const EventsType = {
  ...SendgridEventTypes,
  ...PushEventTypes,
  ...TwillioEventTypes,
};

export interface ContactEditableAttributes {
  lastSent?: Date;
  lastSentDate?: Date | string;
  lastOpen?: Date;
  lastOpenDate?: Date | string;
  lastClick?: Date;
  lastClickDate?: Date | string;
  isActive?: boolean;
  isUnsubscribed?: boolean;
  hasBounced?: boolean;
  bounceType?: 'HARD' | 'SOFT' | null;
  bouncedAt?: Date;
  whatsappLastSent?: Date;
  whatsappLastDelivered?: Date;
  whatsappLastOpen?: Date;
  whatsappLastClick?: Date;
  smsLastSent?: Date;
  smsLastDelivered?: Date;
  smsLastClick?: Date;
}

export interface ContactDeviceEditableAttributes {
  lastSent?: Date;
  lastSentDate?: Date | string;
  lastDelivered?: Date;
  lastDeliveredDate?: Date | string;
  lastView?: Date;
  lastViewDate?: Date | string;
  lastClick?: Date;
  lastClickDate?: Date | string;
  isActive?: boolean;
}

export interface GroupedEvents {
  id: string;
  accountId: number;
  delivered: Event[];
  click: Event[];
  open: Event[];
  bounce: Event[];
  blocked: Event[];
  unsubscribe: Event[];
  group_unsubscribe: Event[];
  dropped: Event[];
  spamreport: Event[];
  delivery: Event[];
  initial_open: Event[];
  amp_open: Event[];
  amp_initial_open: Event[];
  list_unsubscribe: Event[];
  link_unsubscribe: Event[];
  spam_complaint: Event[];
}

export interface ProcessedGroup {
  accountId: number;
  timeZone: string;
  events: {
    type: string;
    eventList: SendgridPayload[];
  }[];
}

export interface TwilioEvent {
  platform: PlatformType.TWILIO;
  categories: TwilioCategory;
  payload: TwilioPayload;
}

export interface TwilioCategory {
  platform: string;
  message_type: 'sms' | 'whatsapp';
  type: string;
  uuid: string;
  account: number;
  contactId: number;
  id: string;
  message: number;
  automation: number;
  automationName: string;
  campaign_type: string;
  campaign: number;
  domain?: string;
  url?: string;
  utm_source: string;
  utm_medium: string;
  utmcampaign: string;
}

export interface TwilioPayload {
  event: TwillioEventTypes;
  ip?: string;
  url?: string;
  headers?: IncomingHttpHeaders;

  ErrorCode: number | undefined;
  SmsSid: string | undefined;
  MessageStatus: string | undefined;
  To: string | undefined;
  MessagingServiceSid: string | undefined;
  MessageSid: string | undefined;
  AccountSid: string | undefined;
  From: string | undefined;
  ApiVersion: string | undefined;
  StructuredMessage: string | undefined;
  ChannelToAddress: string | undefined;
  ChannelPrefix: string | undefined;
  ChannelInstallSid: string | undefined;
  RawDlrDoneDate: string | undefined; // format YYMMDDHHMM
}

export interface EventLog {
  [key: string]: any;
}

export interface CustomEventRequest {
  payload: CustomEvents[];
  platform: PlatformType.CUSTOMEVENTS;
}

export interface CustomEvents {
  apiKey: string;
  uuid: string;
  contactId: number;
  email: string;
  event: string;
  properties: Record<string, string>;
  ip: string;
  url: string;
  userAgent: string;
  timestamp: number;
  eventId?: number;
}

export interface TestAbEvent {
  campaignId: string;
  messageId: string;
  eventType: string;
}

export interface Contact {
  id: number;
  account_id: number;
  email: string;
  email_provider: string;
  first_name: string;
  last_name: string;
  hashed_email: string;
  phone: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postal: string | null;
  ip: string | null;
  latitude: string | null;
  longitude: string | null;
  timezone: string | null;
  is_active: boolean;
  is_unsubscribed: boolean;
  has_bounced: boolean;
  bounce_type: 'HARD' | 'SOFT' | null;
  bounced_at: Date | null;
  last_open: Date | null;
  last_click: Date | null;
  last_sent: Date | null;
  score: number | null;
  score_forecast: number | null;
  created_at: Date | null;
  created_at_date: Date | null;
  updated_at: Date | null;
  last_automation: Date | null;
  uuid: string | null;
  is_valid: boolean;
  has_email: boolean;
  has_phone: boolean;
  has_web_push: boolean;
  has_mobile_push: boolean;
  last_open_date: Date | null;
  last_click_date: Date | null;
  last_sent_date: Date | null;
  last_automation_date: Date | null;
  whatsapp: boolean;
  has_whatsapp: boolean;
  whatsapp_last_sent: Date | null;
  whatsapp_last_delivered: Date | null;
  whatsapp_last_open: Date | null;
  whatsapp_last_click: Date | null;
  sms_last_sent: Date | null;
  sms_last_delivered: Date | null;
  sms_last_click: Date | null;
  sent_count: number | null;
  unsubscribed_at: Date | null;
  is_blocked: boolean;
  blocked_at: Date | null;
}
