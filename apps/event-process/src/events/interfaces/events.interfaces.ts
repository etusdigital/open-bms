import { PlatformType } from './push.interfaces';

export interface ContactEditableAttributes {
  lastSent?: Date;
  lastSentDate?: string;
  lastOpen?: Date;
  lastOpenDate?: string;
  lastClick?: Date;
  lastClickDate?: string;
  isUnsubscribed?: boolean;
  unsubscribedAt?: Date | null;
  hasBounced?: boolean;
  bounceType?: 'HARD' | 'SOFT' | null;
  bouncedAt?: Date;
  isActive?: boolean;
  smsLastSent?: Date;
  smsLastDelivered?: Date;
  smsLastOpen?: Date;
  smsLastClick?: Date;
  whatsappLastSent?: Date;
  whatsappLastDelivered?: Date;
  whatsappLastOpen?: Date;
  whatsappLastClick?: Date;
}

export interface ContactValidateEditableAttributes {
  lastOpen?: Date;
  lastClick?: Date;
  unsubscribedAt?: Date | null;
  bouncedAt?: Date;
}

export interface ContactDeviceEditableAttributes {
  lastSent?: Date;
  lastSentDate?: string;
  lastDelivered?: Date;
  lastDeliveredDate?: string;
  lastClick?: Date;
  lastClickDate?: string;
  isActive?: boolean;
}

export interface SendgridPayload {
  email: string;
  timestamp: number;
  event: string;
  category: string[];
  sg_event_id: string;
  sg_message_id: string;
  reason?: string;
  response?: string;
  attempt?: number;
  status?: string;
  type?: string;
  ip?: string;
  useragent?: string;
  url?: string;
  url_offset?: {
    index: number;
    type: string;
  };
  contactId?: string;
  messageId?: string | number;
  sent_at?: string;
  batch_page?: string;
  batch_schedule_to?: string;
  batch_spread?: string;
  properties?: any;
  bounce_classification?: string;
  geoData?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

export interface SendgridEvent {
  payload: SendgridPayload[];
  platform: PlatformType;
  account: string;
}

export interface TwilioEvent {
  payload: {
    event: string;
    ip?: string;
    url?: string;
    headers?: {
      'user-agent': string;
    };
    ErrorCode?: number;
  };
  categories: {
    account: number;
    message: number;
    contactId: number;
    message_type: string;
    platform: string;
    type: string;
    automation?: number;
    campaign?: number;
    utmcampaign?: string;
  };
  platform: PlatformType;
}

export interface EventLog {
  time: Date;
  date: string;
  accountId: number;
  messageType?: string;
  event: string;
  email?: string;
  contactId?: number;
  automationId?: number;
  campaignId?: number;
  messageId?: number | string;
  utmCampaign?: string;
  provider?: string;
  provider_account?: string;
  isTestAb?: boolean;
  reason?: string;
  url?: string;
  pool?: string;
  linkPosition?: number;
  ip?: string;
  userAgent?: string;
  is_mobile?: boolean;
  os?: string;
  os_version?: string;
  browser?: string;
  country?: string;
  region?: string;
  city?: string;
  traits?: {
    asn: number;
    asnOrg: string;
    isp: string;
    organization: string;
    userType: string;
    connectionType: string;
    isAnycast: boolean;
  };
  secondsSinceSent?: number;
  uuid?: string;
  eventId?: number;
  properties?: Record<string, any>;
  value?: number;
  delivered_id?: string;
}

export interface CustomEventRequest {
  payload: Array<{
    apiKey: string;
    accountId?: string | number;
    uuid?: string;
    email?: string;
    contactId?: number;
    event: string;
    timestamp?: number | string;
    properties?: Record<string, any>;
    ip?: string;
    url?: string;
    userAgent?: string;
    automationId?: number;
    campaignId?: number;
    messageId?: number;
  }>;
  platform: PlatformType;
}

export interface InternalRequest {
  payload: InternalEvent[];
  platform: PlatformType;
}

export interface TestAbEvent {
  campaignId: string;
  messageId: string;
  eventType: string;
}

export interface AutomationTargetEvent {
  contactId: number;
  automationId: number;
  accountId: number;
}

export interface InternalEvent {
  accountId: string;
  uuid?: string;
  apiKey?: string;
  email?: string;
  contactId?: number;
  event: string;
  reason?: string;
  timestamp: number | string;
  properties?: Record<string, any>;
  ip?: string;
  url?: string;
  userAgent?: string;
  automationId?: number | null;
  campaignId?: number | null;
  messageId?: number | null;
}

export interface GroupedEvents {
  id: string;
  accountId: number;
  processed: SendgridPayload[];
  delivered: SendgridPayload[];
  deferred: SendgridPayload[];
  click: SendgridPayload[];
  open: SendgridPayload[];
  bounce: SendgridPayload[];
  blocked: SendgridPayload[];
  unsubscribe: SendgridPayload[];
  group_unsubscribe: SendgridPayload[];
  dropped: SendgridPayload[];
  spamreport: SendgridPayload[];
  delivery: SendgridPayload[];
  initial_open: SendgridPayload[];
  amp_open: SendgridPayload[];
  amp_initial_open: SendgridPayload[];
  list_unsubscribe: SendgridPayload[];
  link_unsubscribe: SendgridPayload[];
  spam_complaint: SendgridPayload[];
  [key: string]: SendgridPayload[] | string | number;
}

export interface ProcessedGroup {
  accountId: number;
  timeZone: string;
  events: {
    type: string;
    eventList: SendgridPayload[];
  }[];
}

export enum EventsType {
  PROCESSED = 'processed',
  DROPPED = 'dropped',
  DELIVERED = 'delivered',
  DEFERRED = 'deferred',
  BOUNCE = 'bounce',
  BLOCKED = 'blocked',
  OPEN = 'open',
  CLICK = 'click',
  SPAMREPORT = 'spamreport',
  UNSUBSCRIBE = 'unsubscribe',
  GROUPUNSUBSCRIBE = 'group_unsubscribe',
  GROUPRESUBSCRIBE = 'group_resubscribe',
  ACCOUNT_STATUS_CHANGE = 'account_status_change',
  SENT = 'sent',
  READ = 'read',
}

export enum SendgridEventTypes {
  PROCESSED = 'processed',
  DROPPED = 'dropped',
  DELIVERED = 'delivered',
  DEFERRED = 'deferred',
  BOUNCE = 'bounce',
  BLOCKED = 'blocked',
  OPEN = 'open',
  CLICK = 'click',
  SPAMREPORT = 'spamreport',
  UNSUBSCRIBE = 'unsubscribe',
  GROUPUNSUBSCRIBE = 'group_unsubscribe',
  GROUPRESUBSCRIBE = 'group_resubscribe',
  ACCOUNT_STATUS_CHANGE = 'account_status_change',
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
