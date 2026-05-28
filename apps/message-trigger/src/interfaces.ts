export interface Contact {
  id?: number;
  accountId?: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  grupo?: string;
  beneficio?: string;
  renda?: string;
  audienceName?: string;
  audienceUrl?: string;
  hashedEmail?: string;
  leadTdSscId?: string;
  leadTdClientId?: string;
  campaignIdAquisicao?: string;
  utmCampaignAquisicao?: string;
  recommendationName?: string;
  recommendationUrl?: string;
  quizId?: string;
  leadTdGlobalId?: string;
  utmContent?: string;
  lastOpen?: Date;
  lastClick?: Date;
  isValid?: boolean;
  hasEmail?: boolean;
  uuid?: string;
}

export interface Account {
  id?: number;
  name?: string;
  description?: string;
  accountConfigs?: Record<string, string>;
  customFields: Array<string>;
  defaultDomain?: string;
  domains?: string;
  defaultSenderName?: string;
  defaultSenderEmail?: string;
  defaultAddress?: string;
  sendgridKey?: string;
  settings?: string;
  linkUnsubscriber?: string;
}

export interface AccountConfig {
  accountId: number;
  name: string;
  value: string;
  description: string;
}

export interface Email {
  id: number;
  title: string;
  ippool: string;
  subject: string;
  previewText?: string;
  replyTo: string;
  priority: string;
  location: {
    bucketName: string;
    fileName: string;
  };
  from: {
    firstName: string;
    email: string;
  };
}

export interface Step {
  id: number;
  type: StepType;
  settings?: any;
  isTestabMode?: boolean;
  child?: any;
}

export enum StepType {
  EMAIL = 'email',
  END = 'end',
  WAIT = 'wait',
  CONDITIONAL_TIME = 'conditionalTime',
  ADD_TAG = 'addTag',
  REMOVE_TAG = 'removeTag',
  CONDITIONAL = 'conditional',
  SPLIT = 'split',
  WEB_PUSH = 'webPush',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  TESTAB = 'testAB',
  UPDATE_CUSTOM_FIELD = 'updateCustomField',
  HTTP_REQUEST = 'httpRequest',
  MOBILE_PUSH = 'mobilePush',
  RANDOM_MESSAGE = 'randomMessage',
  RANDOM_WEB_PUSH = 'randomWebPush',
  RANDOM_MOBILE_PUSH = 'randomMobilePush',
  CONTACT_TRANSFER = 'contactTransfer',
  REMOVE_AUTOMATION = 'removeAutomation',
}

export enum EmailPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}

export interface Automation {
  id: number;
  type: 'email' | 'retargeting' | 'transactional';
  isRateLimit?: boolean;
  title?: string;
  name?: string;
  version?: string;
  steps: Step[];
  account?: Account;
}

export interface ClickHousePayload {
  accountId: number;
  uuid?: string;
  email?: string;
  contactId?: number;
  event: string;
  timestamp: number | string;
  properties?: Record<string, any>;
  ip?: string;
  url?: string;
  event_type?: string;
  userAgent?: string;
  automationId?: number | null;
  campaignId?: number | null;
  messageId?: number | null;
}

export interface LeadStateMessage {
  id: string | number;
  account?: Account;
  automation?: Automation;
  activeStepId: string;
  activeEmailId?: number;
  contact: Contact;
  tagName?: string;
  startedAt: number;
  leadId?: number;
  messageIdEmail1?: number | null;
}

export interface Next {
  pubName: string;
  data: LeadStateMessage;
}

export interface CompressedPayload {
  automationKey: string;
  contactId: number;
  automationId: number;
  stepId: number;
}

export interface SendEmailMessage {
  startedAt: number;
  automationId: number;
  automationName: string;
  automationType: 'email' | 'retargeting' | 'transactional';
  isRateLimit?: boolean;
  // Forwarded from the trigger so send-email can decide whether the
  // per-(account, contact, template) Redis dedup applies. 'multiply' /
  // 'multiply-period' triggers are meant to re-send to the same contact;
  // the gating already happened upstream in tag-process.
  applyFrequency?: 'unique' | 'multiply' | 'multiply-period';
  utmContent: string;
  utmCampaign: string;
  emailId?: number;
  contact: Contact;
  message: Email;
  account?: Account;
  next: Next;
}

export enum ConditionType {
  Date = 'date',
}

export enum ConditionName {
  TimeAmericaSP = 'time,America/Sao_Paulo',
}

export interface CustomField {
  [key: string]: string;
}

export enum StatusTestAb {
  NOTSTARTED = 'notStarted',
  RUNNING = 'running',
  FINISHED = 'finished',
}

export enum EmailVerify {
  DELIVERABLE = 'deliverable',
  UNDELIVERABLE = 'undeliverable',
}

export enum CustomFieldKeyType {
  NAME = 'name',
  ID = 'id',
}
