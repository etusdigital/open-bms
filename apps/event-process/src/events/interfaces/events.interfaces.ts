import { PlatformType } from './push.interfaces';
import type { Traits } from '@bms/geo';

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

// ─────────────────────────────────────────────────────────────
// SparkPost
// ─────────────────────────────────────────────────────────────

// SparkPost wraps each event in `msys.<class>_event` envelope. Webhooks
// post an array of envelopes; each one carries exactly one event class.
export type SparkPostEventClass = 'message_event' | 'track_event' | 'unsubscribe_event' | 'gen_event' | 'relay_event';

export interface SparkPostRawEvent {
  type: string;
  event_id?: string;
  timestamp?: number | string;
  rcpt_to?: string;
  raw_rcpt_to?: string;
  rcpt_meta?: Record<string, string | number | boolean>;
  rcpt_tags?: string[];
  campaign_id?: string;
  subaccount_id?: number | string;
  message_id?: string;
  transmission_id?: string;
  ip_address?: string;
  ip_pool?: string;
  user_agent?: string;
  geo_ip?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    postal_code?: string;
  };
  delv_method?: string;
  queue_time?: number;
  raw_reason?: string;
  reason?: string;
  // SparkPost emits bounce_class as a numeric string in webhooks.
  bounce_class?: string | number;
  error_code?: string;
  click_tracking?: boolean;
  open_tracking?: boolean;
  subject?: string;
  from_address?: string;
  target_link_url?: string;
  target_link_name?: string;
  ab_test_id?: string;
  ab_test_version?: string;
  num_retries?: number;
  // Permits forward-compatible fields without losing them on normalize.
  [key: string]: any;
}

// One SparkPost webhook envelope. Producers may also send a bare
// envelope (not wrapped in array) for single events; the controller
// adapter normalizes both shapes upstream.
export interface SparkPostEnvelope {
  msys?: Partial<Record<SparkPostEventClass, SparkPostRawEvent>>;
}

// Normalized internal payload used by SparkpostService pipeline.
// Mirrors the SendgridPayload shape so downstream helpers
// (parseEventType, statistics, eventLogs) can be reused.
export interface SparkPostPayload {
  email: string;
  timestamp: number;
  // Mapped to the EventsType enum value (e.g. 'delivered', 'bounce').
  event: string;
  // Original SparkPost type kept for HARD/SOFT split, statistics,
  // and traceability in event_log.properties.
  sparkpostType: string;
  // SparkPost rcpt_meta serialized as `key:value` strings so it can
  // be passed through formatterUtils.parseEventType (which expects
  // SendGrid-style category arrays). Mirrors SendgridPayload.category.
  category: string[];
  // Stable ID used for Redis dedup (sparkpost event_id).
  sp_event_id: string;
  // Provider message id (per-recipient) — canonical correlation key for
  // delivery↔open↔click joins in ClickHouse. Falls back to transmission_id
  // only when message_id is absent.
  sp_message_id: string;
  // Per-batch SparkPost transmission id, kept for batch-level observability.
  sp_transmission_id?: string;
  reason?: string;
  attempt?: number;
  type?: string;
  ip?: string;
  useragent?: string;
  url?: string;
  contactId?: string;
  messageId?: string | number;
  bounce_class?: number;
  bounce_classification?: string;
  status?: string;
  properties?: any;
  geoData?: {
    country?: string;
    region?: string;
    city?: string;
    traits?: Traits;
  };
  url_offset?: { index: number; type: string };
  sent_at?: string;
}

// SparkPost top-level event types. Mapped to EventsType in the service.
export enum SparkPostEventTypes {
  // message_event
  DELIVERY = 'delivery',
  BOUNCE = 'bounce',
  INJECTION = 'injection',
  OUT_OF_BAND = 'out_of_band',
  POLICY_REJECTION = 'policy_rejection',
  DELAY = 'delay',
  // track_event
  OPEN = 'open',
  INITIAL_OPEN = 'initial_open',
  CLICK = 'click',
  AMP_OPEN = 'amp_open',
  AMP_INITIAL_OPEN = 'amp_initial_open',
  AMP_CLICK = 'amp_click',
  // unsubscribe_event
  LIST_UNSUBSCRIBE = 'list_unsubscribe',
  LINK_UNSUBSCRIBE = 'link_unsubscribe',
  // gen_event
  GENERATION_FAILURE = 'generation_failure',
  GENERATION_REJECTION = 'generation_rejection',
  // spam complaint (delivered as message_event in some versions, dedicated in others)
  SPAM_COMPLAINT = 'spam_complaint',
}

// SparkPost numeric bounce class (subset used by the pipeline).
// Source: https://support.sparkpost.com/docs/api/bounce-classification-codes
export enum SparkPostBounceClass {
  UNDETERMINED = 1,
  INVALID_RECIPIENT = 10,
  SOFT_BOUNCE = 20,
  DNS_FAILURE = 21,
  MAILBOX_FULL = 22,
  TOO_LARGE = 23,
  TIMEOUT = 24,
  ADMIN_FAILURE = 25,
  GENERIC_BOUNCE_NO_RCPT = 30,
  GENERIC_BOUNCE = 40,
  MAIL_BLOCK = 50,
  SPAM_BLOCK = 51,
  SPAM_CONTENT = 52,
  PROHIBITED_ATTACHMENT = 53,
  RELAYING_DENIED = 54,
  AUTO_REPLY = 60,
  TRANSIENT_FAILURE = 70,
  SUBSCRIBE = 80,
  UNSUBSCRIBE = 90,
  CHALLENGE_RESPONSE = 100,
}

// Bounce classes that indicate a recipient-side issue (mark contact bounced).
// Anything else is sender/reputation/transient and tracked as 'blocked'.
export const SPARKPOST_RECIPIENT_BOUNCE_CLASSES: ReadonlySet<number> = new Set([
  SparkPostBounceClass.INVALID_RECIPIENT,
  SparkPostBounceClass.MAILBOX_FULL,
  SparkPostBounceClass.ADMIN_FAILURE,
]);

// Recipient classes that should be persisted as HARD bounces (vs SOFT).
export const SPARKPOST_HARD_BOUNCE_CLASSES: ReadonlySet<number> = new Set([
  SparkPostBounceClass.INVALID_RECIPIENT,
  SparkPostBounceClass.ADMIN_FAILURE,
]);

// Bounce classes that are informational ARF feedback rather than real bounces.
// SparkPost emits them with type='bounce' but the contact-side handling
// differs — see SparkpostService.normalizePayload for the routing.
//   80  — Subscribe (drop)
//   90  — Unsubscribe via List-Unsubscribe-Post (remap to UNSUBSCRIBE)
//   100 — Challenge-Response (treat as HARD recipient bounce)
export const INFORMATIONAL_OR_REMAP_CLASSES: ReadonlySet<number> = new Set([
  SparkPostBounceClass.SUBSCRIBE,
  SparkPostBounceClass.UNSUBSCRIBE,
  SparkPostBounceClass.CHALLENGE_RESPONSE,
]);

export interface SparkPostEvent {
  payload: SparkPostEnvelope[];
  platform: PlatformType;
  account?: string;
}
