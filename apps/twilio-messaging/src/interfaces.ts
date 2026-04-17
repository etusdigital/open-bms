export interface Contact {
  id?: number;
  uuid?: string;
  token: string;
  email?: string;
  emailProvider?: string;
  accountId?: number;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  name?: string;
  hashedEmail?: string;
  phone?: string;
  whatsapp?: string;
  isUnsubscribed?: boolean;
  hasBounced?: boolean;
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasWebPush?: boolean;
  hasMobilePush?: boolean;
  hasWhatsapp?: boolean;
  customFields?: ContactCustomField[] | Record<string, string>[];
  contactDevices?: ContactDevice[];
  city?: string;
  region?: string;
  country?: string;
  postal?: string;
  ip?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  link?: string;
}

export interface ContactCustomField {
  contactId: number;
  customFieldId: number;
  value: string;
}

export enum DeviceType {
  EMAIL = 'email',
  PHONE = 'phone',
  WEBPUSH = 'web-push',
  MOBILEPUSH = 'mobile-push',
}

export interface ContactDevice {
  id?: number;
  accountId: number;
  contactId: number;
  type: DeviceType;
  token: string;
  isUnsubscribed: boolean;
  isActive: boolean;
  ip?: string;
  os?: string;
  browser?: string;
  resolution?: string;
  subscriptionUrl?: string;
  latestVisitedUrl?: string;
  lastSession?: Date;
  lastSent?: Date;
  lastView?: Date;
  lastClick?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Account {
  id?: number;
  name?: string;
  description?: string;
  accountConfigs?: AccountConfig[];
  defaultDomain?: string;
  domains?: string;
  defaultSenderName?: string;
  defaultSenderEmail?: string;
  defaultAddress?: string;
  sendgridKey?: string;
  settings?: string;
  linkUnsubscriber?: string;
  apiKey?: string;
  customFields?: CustomFields[];
}

export interface AccountConfig {
  accountId: number;
  name: string;
  value: string;
  description: string;
}

export interface CustomFields {
  id: number;
  accountId: number;
  title: string;
  name: string;
  description: string;
  order: number;
}

export interface Campaign {
  id: number;
  title: string;
  name: string;
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
  campaignMessage?: Message[];
  type: CampaignType;
  messageType: CampaignMessageType;
  testeabScheduleTo?: string;
  testeabScheduleEnd?: string;
  testabAudiencePercent?: number;
  testabCriteria?: string;
  testabSentAfterTest?: boolean;
  testabLastId?: number;
  testabinInitialPageId?: number;
  testabMode?: boolean;
}

export enum CampaignType {
  SIMPLE = 'simple',
  TESTAB = 'testab',
  SPLIT = 'split',
}

export enum CampaignMessageType {
  EMAIL = 'email',
  WEBPUSH = 'web-push',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
}

export interface Message {
  id: number;
  accountId: number;
  title: string;
  name: string;
  subject?: string;
  previewText?: string;
  replyTo?: string;
  content?: string;
  contentJson?: string;
  fromMail?: string;
  fromName?: string;
  templateUrl?: string;
  bucketName?: string;
  fileName?: string;
  priority?: string;
  ippool?: string;
  url?: string;
  image?: string;
  requireInteraction?: boolean;
  expiryPushInSeconds?: number;
  providerMessageId?: string;
  type?: string;
}

export interface CampaignMessage {
  account: Account;
  campaign: Campaign;
  contacts: Contact[];
  message: Message;
  page?: number;
  totalPages?: number;
  campaign_id: number;
  campaign_name?: string;
  campaign_test_ab_mode?: boolean;
}

export class PubSubMessage {
  subscription: string;
  message: {
    attributes: any;
    data: string;
    messageId: string;
    message_id: string;
    publishTime: string;
    publish_time: string;
  };
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

export interface AutomationMessage {
  startedAt: number;
  automationId: number;
  automationName: string;
  automationType: 'email' | 'retargeting' | 'transactional';
  utmContent: string;
  utmCampaign: string;
  contact: Contact;
  message: Message;
  next: Next;
  account: Account;
  messageId: string;
}

export interface SingleMessage {
  to: string;
  body: string;
  account: Account;
}

export interface Automation {
  id: string;
  type: 'email' | 'retargeting' | 'transactional';
  activeStep: any;
  steps: any;
}

export interface MapVariables {
  [key: string]: string;
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
