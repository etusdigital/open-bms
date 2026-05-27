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
  campaignDefault?: any;
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
  MOBILEPUSH = 'mobile-push',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
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

export class PageMessage {
  payload: string;
  waitFor: number;
  page?: number;
}

export class CampaignMessage {
  campaignId: number;
  messageId: number;
  statistics?: string;
  winner?: boolean;
  resultDate?: Date;
  message: Email;
}

export class CampaignBatch {
  campaign: Campaign;
  page: number;
  totalPages: number;
  currentContactId: number;
  finalContactId: number;
}

export enum EmailPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}

export interface Batch {
  account: Account;
  contacts: ContactSegmented[];
  email: Email;
  page?: number;
  totalPages?: number;
  campaign_id: number;
}

export interface Email {
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
  priority?: EmailPriority | string;
  ippool?: string;
  url?: string;
  image?: string;
  expiryPushInSeconds?: number;
}

export interface ContactSegmented {
  email: string;
  hashedEmail: string;
  emailProvider?: string;
  accountId?: number;
  firstName?: string;
  lastName?: string;
  isUnsubscribed?: boolean;
  hasBounced?: boolean;
  customFields?: any;
  phone?: string;
  grupo?: string;
  beneficio?: string;
  renda?: string;
  link?: string;
}

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

export interface Contact {
  id: number;
  name: string;
  email: string;
  emailProvider: string;
  firstName: string;
  lastName: string;
  fullName: string;
  hashedEmail: string;
  phone: string;
  isActive: boolean;
  isUnsubscribed: boolean;
  hasBounced: boolean;
  lastOpen: number;
  lastClick: number;
  lastSent: number;
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasWebPush?: boolean;
  hasMobilePush?: boolean;
  hasWhatsapp?: boolean;
  whatsapp: string;
  customFields?: ContactCustomField[] | Record<string, string>[];
  devices?: ContactDevice[];
  city?: string;
  region?: string;
  country?: string;
  postal?: string;
  ip?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  score: number;
  scoreForecast: number;
  createdAt: Date;
  createdAtDate: Date;
  updatedAt: Date;
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

export interface Tag {
  id: number;
  name: string;
  createdAt: Date;
}

export interface ContactTag {
  contactId: number;
  tagId: number;
}

export interface Account {
  id?: number;
  name?: string;
  description?: string;
  groupId?: number;
  accountConfigs?: AccountConfig[];
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

export interface CustomField {
  [key: string]: string;
}
