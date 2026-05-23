import { AccountEntity } from './msgops/entities/account.entity';
import { AutomationEntity } from './msgops/entities/automation.entity';
import { ContactEntity } from './msgops/entities/contact.entity';

export interface LeadMessage {
  id: number;
  account: AccountEntity;
  contact: ContactEntity;
  automation?: AutomationEntity;
  tagName?: string;
  webPush?: boolean;
  mobilePush?: boolean;
  apiKey?: string;
  startedAt: number;
  contactValidate?: boolean;
  contactUpdate?: boolean;
  startAutomation?: boolean;
  leadId?: number;
  isLeadFromAnotherAutomation?: boolean;
  messageIdEmail1?: number | null;
  isImport?: boolean;
  accountChange?: any;
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
  message: Record<string, unknown>;
  steps: MsgOpsAutomationsStep[];
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
  stepType?: StepTypeObject;
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

export interface StepTypeObject {
  id: number;
  name: string;
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

export interface PubSubMessage {
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

export interface EventsTrigger {
  accountId: number;
  contactId?: number | string;
  uuid?: string;
  messageId?: number;
  eventId?: number;
  event?: 'open' | 'click' | 'custom_events' | 'first_open_30_days';
  isTriggerCampaign?: boolean;
}

export interface EventsTarget {
  accountId: number;
  contactId: number;
  automationId: number;
}

export interface Email {
  id: number;
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
  emailStepId?: number;
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
  id: number;
  type: string;
  title: string;
  name: string;
  version: string;
  steps: any;
  triggers: any;
  account?: Account;
}

export interface LeadStateMessage extends LeadMessage {
  automation: AutomationEntity;
  startedAt: number;
  activeStepId: string;
}

export const msgOpsStepIds = {
  1: 'email',
  2: 'timer',
  3: 'add_into_list',
  4: 'remove_from_list',
  5: 'end',
  6: 'add_tag',
  7: 'condition',
  8: 'add_trigger',
  9: 'remove_tag',
  10: 'contact_conditional',
};

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
}

export interface AccountConfig {
  accountId: number;
  name: string;
  value: string;
  description: string;
}

export interface TagBatch {
  action: 'add' | 'remove';
  tag: string;
  accountId?: number;
  tagId?: number;
  apiKey: string;
  createContacts: boolean;
  contacts: ContactBatch[];
}

export interface ContactBatch {
  email: string;
  firstName: string;
  lastName: string;
}

export enum Actions {
  ADD = 'add',
  REMOVE = 'remove',
}
export interface ContactEditableAttributes {
  lastSent?: Date;
  lastSentDate?: Date;
  lastOpen?: Date;
  lastOpenDate?: Date;
  lastClick?: Date;
  lastClickDate?: Date;
  isUnsubscribed?: boolean;
  hasBounced?: boolean;
  lastAutomation?: Date;
  lastVerticalType?: string;
  lastAutomationDate?: Date | string;
}

export enum Status {
  running = 'running',
  canceled = 'canceled',
  completed = 'completed',
  disengaged = 'disengaged',
  duplicate = 'duplicate',
  started = 'started',
}

export interface CustomField {
  [key: string]: string;
}

export interface SegmentInfo {
  date: Date;
  status: boolean;
  duration: number;
  count: number;
  insert?: number;
  delete?: number;
  channels?: {
    email: number;
    mobile_push: number;
    web_push: number;
    phone: number;
    whatsapp: number;
  };
  outInfo?: {
    unsub_qtd: number;
    bounce_qtd: number;
    open_qtd: number;
    click_qtd: number;
    in_tag_qtd: number;
    engagement_qtd: number;
    invalid_qtd: number;
  };
  inInfo?: {
    bought: number;
    reengaged: number;
  };
}

export enum DeviceType {
  EMAIL = 'email',
  PHONE = 'phone',
  WEBPUSH = 'web-push',
  MOBILEPUSH = 'mobile-push',
}

export enum SegmentStatus {
  REACTIVATING = 'reactivating',
  INACTIVE = 'inactive',
  ACTIVE = 'active',
}

export enum TriggerType {
  UNIQUE = 'unique',
  MULTIPLY = 'multiply',
  MULTIPLY_PERIOD = 'multiply-period',
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

export interface SegmentToClickHouse {
  type: 'segment-in' | 'segment-out';
  tagId: number;
  tagName: string;
  accountId: number;
  contacts: Array<{ contact_id }>;
}

export enum CustomFieldKeyType {
  NAME = 'name',
  ID = 'id',
}

export interface SegmentExternalQueryPayload {
  tableName: string;
  query: string;
  filterType: string;
}
