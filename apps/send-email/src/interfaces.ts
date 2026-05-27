export interface Contact {
  id: number;
  email: string;
  name?: string;
  emailProvider?: string;
  accountId?: number;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  hashedEmail?: string;
  phone?: string;
  link?: string;
  isValid: boolean;
  isUnsubscribed?: boolean;
  isBlocked?: boolean;
  hasBounced?: boolean;
  hasEmail?: boolean;
  customFields?: { [key: string]: string };
  tags?: string[];
  city?: string;
  region?: string;
  country?: string;
  postal?: string;
  ip?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  uuid: string;
  isAutomation?: boolean;
}

export interface Email {
  id: number;
  title: string;
  name: string;
  ippool: string;
  subject: string;
  replyTo: string;
  priority: EmailPriority;
  previewText?: string;
  isTestabMode?: boolean;
  content: string;
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
  postion: number;
  id: string;
  type: StepType;
  value?: string;
  config?: Email | any;
  emailStepId?: number;
}

export enum StepType {
  EMAIL = 'email',
  END = 'end',
  TIMER = 'timer',
  ADD_LIST = 'add_list',
  REMOVE_LIST = 'remove_list',
}

export enum EmailPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}

export interface Automation {
  id: string;
  type: 'email' | 'retargeting' | 'transactional';
  isRateLimit: boolean;
  activeStep: Step;
  steps: Step[];
}

export interface LeadMessage {
  contact: Contact;
  tagName: string;
  createdAt: number;
}

export interface LeadStateMessage extends LeadMessage {
  id: string;
  automation: Automation;
  startedAt: number;
  activeStepId: string;
}

export interface Next {
  pubName: string;
  data: LeadStateMessage;
}

export interface SendEmailMessage {
  startedAt: number;
  automationId: number;
  automationName: string;
  automationType: 'email' | 'retargeting' | 'transactional';
  isRateLimit: boolean;
  utmContent: string;
  utmCampaign: string;
  link?: string;
  emailId?: number;
  contact: Contact;
  message: Email;
  next: Next;
  account: Account;
  messageId: string;
  sendAt: number;
  ramdonNumber: number;
}

export interface AutomationContactsBatch extends Omit<SendEmailMessage, 'contact'> {
  contacts: Contact[];
  contact?: Contact;
}

export interface Account {
  id?: number;
  name?: string;
  description?: string;
  accountConfigs?: AccountConfig[];
  defaultDomain?: string;
  domains?: string[];
  defaultSenderName?: string;
  defaultSenderEmail?: string;
  defaultAddress?: string;
  sendgridKey?: string;
  settings?: string[];
  linkUnsubscriber?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  customFields?: CustomFields[];
}

export interface AccountConfig {
  accountId: number;
  name: string;
  value: string;
  description?: string;
}

export interface CustomFields {
  id: number;
  accountId: number;
  title: string;
  name: string;
  description: string;
  order: number;
}

export interface ReplaceLinks {
  [Key: string]: {
    host: string;
    url: string;
  };
}

export class Campaign {
  id: number;
  title: string;
  name: string;
  accountId: number;
  publisher?: string;
  scheduleTo?: Date | string;
  scheduleToCloudTaskId?: string;
  status: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
  audiences?: string[];
  spreadSending: number;
  query: string;
  steps: string;
  account: Account;
  campaignMessage?: CampaignMessage[];
  type: CampaignType;
  messageType: CampaignMessageType;
  testabScheduleTo?: string;
  testabScheduleEnd?: string;
  testabAudiencePercent?: number;
  testabCriteria?: string;
  testabSentAfterTest?: boolean;
  testabLastId?: number;
  testabinInitialPageId?: number;
  testabMode?: boolean;
  maxContactsWarmup?: number;
  isWarmup?: boolean;
  warmupTarget?: number;
  campaignDefault?: any;
  isRateLimit: boolean;
}

export enum CampaignType {
  SIMPLE = 'simple',
  TESTAB = 'testAB',
  SPLIT = 'split',
  RECURRING = 'recurring',
}

export enum CampaignStatus {
  Draft = 0,
  Scheduled = 1,
  Sending = 2,
  Paused = 3,
  Stopped = 4,
  Completed = 5,
  SendingTestAb = 6,
}

export enum CampaignMessageType {
  EMAIL = 'email',
  CAMPAIGN = 'campaign',
  WEBPUSH = 'web-push',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
}

export class CampaignMessage {
  campaignId: number;
  messageId: number;
  statistics?: string;
  winner?: boolean;
  resultDate?: Date;
  message: Email;
}

export interface CompressedAutomationPayload {
  automationKey: string;
  contactId?: number;
  automationId?: number;
  stepId?: number;
}

export interface CompressedCampaignPayload {
  campaignKey: string;
  campaignId?: number;
  page?: number;
  initialContactId?: number;
  finalContactId?: number;
}
