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

// ─────────────────────────────────────────────────────────────
// MailerSend
// ─────────────────────────────────────────────────────────────

// MailerSend webhook envelope. The provider sends one event per POST
// (Activity webhooks) with a generic shape; we accept arrays as well to
// stay future-proof.
export interface MailerSendRawEvent {
  type: string;
  // Unix epoch seconds OR ISO 8601 — the service normalizes both.
  created_at?: string | number;
  webhook_id?: string;
  // The activity data — fields vary by event type. Extracted from `data` in
  // the wire payload (MailerSend wraps event details under .data).
  data?: {
    object?: string;
    id?: string;
    type?: string;
    created_at?: string;
    email?: {
      object?: string;
      id?: string;
      created_at?: string;
      from?: string;
      subject?: string;
      tags?: string[];
      message?: { object?: string; id?: string; created_at?: string };
      recipient?: { object?: string; id?: string; email?: string; created_at?: string };
    };
    morph?: {
      object?: string;
      id?: string;
      type?: string;
      reason?: string;
      readable_reason?: string;
      url?: string;
      ip?: string;
      user_agent?: string;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

// Normalized internal payload mirrors SparkPostPayload shape so the
// pipeline can reuse statistics + analytics helpers.
export interface MailerSendPayload {
  email: string;
  timestamp: number;
  event: string; // mapped to EventsType
  mailersendType: string;
  // SendGrid-style category array synthesized from MailerSend `tags`.
  category: string[];
  ms_event_id: string; // dedup key
  ms_message_id: string; // analytics correlation
  reason?: string;
  ip?: string;
  useragent?: string;
  url?: string;
  contactId?: string;
  messageId?: string | number;
  bounce_classification?: string;
  type?: string; // 'bounce' (HARD) | 'blocked' (SOFT)
  properties?: any;
  geoData?: { country?: string; region?: string; city?: string; traits?: Traits };
}

export enum MailerSendEventTypes {
  SENT = 'activity.sent',
  DELIVERED = 'activity.delivered',
  SOFT_BOUNCED = 'activity.soft_bounced',
  HARD_BOUNCED = 'activity.hard_bounced',
  OPENED = 'activity.opened',
  OPENED_UNIQUE = 'activity.opened_unique',
  CLICKED = 'activity.clicked',
  CLICKED_UNIQUE = 'activity.clicked_unique',
  UNSUBSCRIBED = 'activity.unsubscribed',
  SPAM_COMPLAINT = 'activity.spam_complaint',
}

export interface MailerSendEvent {
  payload: MailerSendRawEvent | MailerSendRawEvent[];
  platform: PlatformType;
  account?: string;
}

// ─────────────────────────────────────────────────────────────
// Resend
// ─────────────────────────────────────────────────────────────

export interface ResendRawEvent {
  type: string; // e.g. 'email.sent', 'email.delivered'
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    created_at?: string;
    // Reasons for bounce/complaint.
    bounce?: { type?: string; subType?: string; message?: string };
    complaint?: { type?: string; feedback_type?: string };
    // Engagement events.
    click?: { ipAddress?: string; userAgent?: string; link?: string; timestamp?: string };
    open?: { ipAddress?: string; userAgent?: string; timestamp?: string };
    tags?: { name: string; value: string }[];
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ResendPayload {
  email: string;
  timestamp: number;
  event: string;
  resendType: string;
  category: string[];
  re_event_id: string;
  re_message_id: string;
  reason?: string;
  ip?: string;
  useragent?: string;
  url?: string;
  contactId?: string;
  messageId?: string | number;
  bounce_classification?: string;
  type?: string;
  properties?: any;
  geoData?: { country?: string; region?: string; city?: string; traits?: Traits };
}

export enum ResendEventTypes {
  SENT = 'email.sent',
  DELIVERED = 'email.delivered',
  DELIVERY_DELAYED = 'email.delivery_delayed',
  BOUNCED = 'email.bounced',
  COMPLAINED = 'email.complained',
  OPENED = 'email.opened',
  CLICKED = 'email.clicked',
  FAILED = 'email.failed',
}

export interface ResendEvent {
  payload: ResendRawEvent;
  platform: PlatformType;
  account?: string;
}

// ─────────────────────────────────────────────────────────────
// Amazon SES (events flow through SNS HTTP/HTTPS subscription)
// ─────────────────────────────────────────────────────────────

// SNS HTTP subscription envelope. Two variants matter:
//   - Notification: real event delivery; Message holds the SES JSON.
//   - SubscriptionConfirmation: one-shot at subscription setup; SubscribeURL
//     must be GETted by the receiver to confirm the topic.
// UnsubscribeConfirmation is also possible but rarely seen and we just log it.
export interface SnsEnvelope {
  Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation';
  MessageId: string;
  TopicArn?: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: '1' | '2';
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
  Token?: string;
  UnsubscribeURL?: string;
  [key: string]: any;
}

// Inner SES event (after JSON.parse(Message)). Documented at
// https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
export interface SesRawEvent {
  eventType: string;
  mail?: {
    timestamp?: string;
    source?: string;
    messageId?: string;
    destination?: string[];
    // Note: SES tags are { name: [values] } — multi-value per name.
    tags?: Record<string, string[]>;
    [key: string]: any;
  };
  bounce?: {
    bounceType?: 'Permanent' | 'Transient' | 'Undetermined';
    bounceSubType?: string;
    bouncedRecipients?: Array<{ emailAddress?: string; status?: string; diagnosticCode?: string }>;
    timestamp?: string;
  };
  complaint?: {
    complainedRecipients?: Array<{ emailAddress?: string }>;
    timestamp?: string;
    complaintFeedbackType?: string;
  };
  delivery?: { timestamp?: string; recipients?: string[]; smtpResponse?: string };
  open?: { ipAddress?: string; userAgent?: string; timestamp?: string };
  click?: { ipAddress?: string; userAgent?: string; link?: string; timestamp?: string };
  reject?: { reason?: string };
  failure?: { errorMessage?: string; templateName?: string };
  [key: string]: any;
}

export interface SesPayload {
  email: string;
  timestamp: number;
  event: string;
  sesType: string;
  category: string[];
  ses_event_id: string;
  ses_message_id: string;
  reason?: string;
  ip?: string;
  useragent?: string;
  url?: string;
  contactId?: string;
  messageId?: string | number;
  bounce_classification?: string;
  type?: string;
  properties?: any;
  geoData?: { country?: string; region?: string; city?: string; traits?: Traits };
}

export enum SesEventTypes {
  SEND = 'Send',
  REJECT = 'Reject',
  BOUNCE = 'Bounce',
  COMPLAINT = 'Complaint',
  DELIVERY = 'Delivery',
  OPEN = 'Open',
  CLICK = 'Click',
  RENDERING_FAILURE = 'RenderingFailure',
  DELIVERY_DELAY = 'DeliveryDelay',
  SUBSCRIPTION = 'Subscription',
}

export interface SesEvent {
  payload: SnsEnvelope;
  platform: PlatformType;
  account?: string;
}

// ─────────────────────────────────────────────────────────────
// Mandrill (MailChimp Transactional)
// ─────────────────────────────────────────────────────────────

// Mandrill posts events as form-urlencoded with a single field
// `mandrill_events=<JSON-encoded array>`. Each array element shape:
export interface MandrillRawEvent {
  event: string;
  ts?: number;
  msg?: {
    ts?: number;
    _id?: string;
    state?: string;
    subject?: string;
    email?: string;
    sender?: string;
    tags?: string[];
    metadata?: Record<string, string>;
    bounce_description?: string;
    bgtools_code?: number;
    diag?: string;
    [key: string]: any;
  };
  ip?: string;
  user_agent?: string;
  url?: string;
  _id?: string;
  [key: string]: any;
}

export interface MandrillPayload {
  email: string;
  timestamp: number;
  event: string;
  mandrillType: string;
  category: string[];
  md_event_id: string;
  md_message_id: string;
  reason?: string;
  ip?: string;
  useragent?: string;
  url?: string;
  contactId?: string;
  messageId?: string | number;
  bounce_classification?: string;
  type?: string;
  properties?: any;
  geoData?: { country?: string; region?: string; city?: string; traits?: Traits };
}

export enum MandrillEventTypes {
  SEND = 'send',
  DEFERRAL = 'deferral',
  HARD_BOUNCE = 'hard_bounce',
  SOFT_BOUNCE = 'soft_bounce',
  OPEN = 'open',
  CLICK = 'click',
  SPAM = 'spam',
  UNSUB = 'unsub',
  REJECT = 'reject',
}

export interface MandrillEvent {
  payload: MandrillRawEvent[];
  platform: PlatformType;
  account?: string;
}
