import { AccountEntity } from './msgops/entities/account.entity';
import { LeadsEntity } from './msgops/entities/leads.entity';

export interface Contact {
  id?: number;
  uuid?: string;
  email?: string;
  emailProvider?: string;
  accountId?: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  hashedEmail?: string;
  phone?: string;
  whatsapp?: string;
  isActive?: boolean;
  isUnsubscribed?: boolean;
  unsubscribedAt?: Date;
  isBlocked?: boolean;
  blockedAt?: Date;
  hasBounced?: boolean;
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasWebPush?: boolean;
  hasMobilePush?: boolean;
  hasWhatsapp?: boolean;
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
  isValid: boolean;
  invalidReason?: string;
  createdAtDate?: Date | string;
  properties?: any;
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
}

export interface AccountConfig {
  accountId: number;
  name: string;
  value: string;
  description: string;
}

export interface Email {
  id?: number;
  title: string;
  ippool: string;
  subject: string;
  replyTo: string;
  previewText?: string;
  priority: EmailPriority;
  location: {
    bucketName: string;
    fileName: string;
  };
  from: {
    firstName: string;
    email: string;
  };
  to: {
    firstName: string;
    email: string;
  };
}

export interface Step {
  position: number;
  id: string;
  type: StepType;
  value: string;
  config?: Email | any;
}

export enum StepType {
  EMAIL = 'email',
  END = 'end',
  TIMER = 'timer',
  ADD_LIST = 'add_list',
  REMOVE_LIST = 'remove_list',
  ADD_TAG = 'add_tag',
  CONDITION = 'condition',
}

export enum EmailPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}

export interface Automation {
  id: string;
  type: 'retargeting' | 'email';
  title: string;
  name: string;
  version: string;
  activeStep: Step;
  steps: Step[];
  account?: Account;
}

export interface LeadMessage extends quizMaker {
  account: Account | AccountEntity;
  contact: Contact;
  tagName?: string | Array<string>;
  removeTag?: string | Array<string>;
  contactValidate?: boolean;
  contactUpdate?: boolean;
  startAutomation?: boolean;
  webPush?: boolean;
  mobilePush?: boolean;
  isImport?: boolean;
  apiKey: string;
  startedAt: number;
  leadId?: number;
  messageIdEmail1?: number | null;
  transactionId?: string;
  type?: string;
  accountChange?: any;
}

export interface quizMaker {
  name?: string;
  email?: string;
  original_email?: string;
  app?: string;
  hashed_email?: string;
  referer?: string;
  query_string?: string;
  direct_to?: string;
  fbp?: string;
  etsclientid?: string;
  gid?: string;
  aff_id?: string;
  krux_id?: string;
  sub_id?: string;
  fbclid?: string;
  gclid?: string;
  taboola_external_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  campaign_id?: string;
  ad_id?: string;
  adset_id?: string;
  source_url?: string;
  origem_cadastro?: string;
  bms_apikey?: string;
  bms_tagname?: string;
  ip?: string;
  user_agent?: string;
  isValid?: boolean;
  invalidReason?: string;
  questions?: {
    quiz_name: string;
    answer_id: string;
    answer_image: string;
    answer_value: string;
    answer_value_key: string;
    step_statement: string;
    answer_type: boolean;
    nx_step: string;
    step_id: string;
    question_key: string;
    question: string;
    answer: string;
    hasImage: boolean;
    exclusiveAnswer: string;
    answer_script: string;
    optionCorrect: boolean;
    optionFeedback: string;
  }[];
  form_fields?: {
    id: string;
    name: string;
    value: string;
  }[];
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
  contact: Contact;
  email: Email;
  next: Next;
}

export interface ResultDto {
  status: boolean;
  message: string;
}

export interface MsgOpsAutomation {
  id: number;
  title: string;
  name: string;
  version: string;
  isActive: boolean;
  type: 'email' | 'retargeting';
  audienceIdExternal: number;
  audienceName: string;
  message: object;
  steps: MsgOpsAutomationsStep[];
  account: Account;
  deletedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MsgOpsAutomationsStep {
  id: number;
  automationId: number;
  stepTypeId: number;
  messageId: number;
  message: any;
  config?: any;
  position: number;
  name: string;
  value: string;
  groups: MsgOpsGroup[];
  deletedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MsgOpsCondition {
  id: string;
  stepId: string;
  groupId: string;
  condition_name?: string;
  type: ConditionType.Date;
  option: ConditionOptions;
  value: number;
  deletedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MsgOpsGroup {
  id: string;
  stepId: string;
  logic: GroupLogic;
  conditions: MsgOpsCondition[];
}

export enum ConditionType {
  Date = 'date',
}

export enum ConditionOptions {
  Equal = 'equal',
  Notequal = 'notequal',
  Greatereq = 'greatereq',
  Greater = 'greater',
  Less = 'less',
  Lesseq = 'lesseq',
}

export enum GroupLogic {
  And = 'and',
  Or = 'or',
}

export const msgOpsStepIds = {
  1: 'email',
  2: 'timer',
  3: 'add_into_list',
  4: 'remove_from_list',
  5: 'end',
  6: 'add_tag',
  7: 'condition',
};

export enum EmailVerify {
  DELIVERABLE = 'deliverable',
  UNDELIVERABLE = 'undeliverable',
  DEFERRED = 'deferred',
  RISKY = 'risky',
  UNKNOWN = 'unknown',
}

export enum CustomFieldsType {
  NUMBER = 'number',
  DATE = 'date',
}

export type Lead = Omit<LeadsEntity, 'id' | 'createdAt' | 'updatedAt'>;

export interface EmailChecker {
  accept_all: boolean;
  did_you_mean: string;
  disposable: boolean;
  domain: string;
  duration: number;
  email: string;
  first_name: string;
  free: boolean;
  full_name: string;
  gender: string;
  last_name: string;
  mailbox_full: boolean;
  mx_record: string;
  no_reply: boolean;
  reason: string;
  role: boolean;
  score: number;
  smtp_provider: string;
  state: string;
  tag: string;
  user: string;
  result: EmailVerify;
}

export interface EventLogResubscribed {
  currentDate: string;
  accountId: number;
  contactId: number;
  email: string;
  event: string;
  reason: string;
  url: string;
  ip: string;
  country: string;
  region: string;
  city: string;
}
