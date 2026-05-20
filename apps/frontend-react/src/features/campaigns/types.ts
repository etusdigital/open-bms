import type { Message } from '@/features/messages/types';
import type { AccountChannels } from '@/types';

export type CampaignType = 'simple' | 'testAB' | 'split' | 'recurring';

export type CampaignMessageType = 'email' | 'sms' | 'web-push' | 'mobile-push' | 'whatsapp';

/** Maps a campaign messageType to the account channel flag that gates its availability. */
export const MESSAGE_TYPE_CHANNEL_KEY: Record<CampaignMessageType, keyof AccountChannels> = {
  email: 'email',
  sms: 'sms',
  'web-push': 'webPush',
  'mobile-push': 'mobilePush',
  whatsapp: 'whatsapp',
};

/** Channel resolution order used when picking a default messageType. */
export const CHANNEL_PRIORITY: CampaignMessageType[] = ['email', 'sms', 'web-push', 'mobile-push', 'whatsapp'];

/** Returns the first channel active for the account, falling back to 'email' when none are. */
export function firstActiveChannel(channels: AccountChannels): CampaignMessageType {
  return CHANNEL_PRIORITY.find((c) => channels[MESSAGE_TYPE_CHANNEL_KEY[c]]) ?? 'email';
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

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  [CampaignStatus.Draft]: 'campaigns.statusDraft',
  [CampaignStatus.Scheduled]: 'campaigns.statusScheduled',
  [CampaignStatus.Sending]: 'campaigns.statusSending',
  [CampaignStatus.Paused]: 'campaigns.statusPaused',
  [CampaignStatus.Stopped]: 'campaigns.statusStopped',
  [CampaignStatus.Completed]: 'campaigns.statusCompleted',
  [CampaignStatus.SendingTestAb]: 'campaigns.statusSendingTestAb',
};

export enum RecurrenceFrequency {
  Daily = 1,
  Weekly = 2,
  Monthly = 3,
}

/** Audience step item — a single element within an audience card */
export interface AudienceStepItem {
  type: 'tag' | 'conditional' | 'conditionalCard';
  tag_id?: number[];
  value?: 'UNION' | 'EXCEPT';
  isCardCopy?: boolean;
  /** Per-tag-row conditional: 'in' = "Tem" / 'not in' = "Não tem" */
  conditional_tag?: 'in' | 'not in';
  /** Between tag rows within a card: 'UNION' = "Incluir" / 'EXCEPT' = "Não incluir" */
  conditional?: 'UNION' | 'EXCEPT';
  /** Tag metadata required by backend filterTags() and campaign-packer */
  tag_info?: Array<{ id: number; name: string; count?: number; type?: string }>;
}

/** An audience card is an array of step items */
export type AudienceCard = AudienceStepItem[];

/** Campaign message = full Message from API + optional campaign-specific fields.
 *  We use Partial<Message> so all API fields are preserved in the payload. */
export interface CampaignMessage extends Partial<Message> {
  messageId?: number;
  statistics?: MessageStatistics;
  winner?: boolean;
}

export interface MessageStatistics {
  delivered?: number;
  openRate?: number;
  clickRate?: number;
  ctrOrRate?: number;
}

/** Per-link click statistics entry — key is 0-based link index, total is click count as string (from SQL sum) */
export interface ClickStatEntry {
  key: string;
  total: string;
}

export interface RecurrenceSettings {
  date?: string;
  interval?: number;
  frequency?: RecurrenceFrequency | null;
  weekDays?: number[];
  hasExpiration?: boolean;
  untilDate?: string | null;
  untilSend?: number | null;
  firstSentDate?: string | null;
  lastSentDate?: string | null;
}

export interface Campaign {
  id: number;
  title: string;
  name?: string;
  description?: string;
  type: CampaignType;
  messageType: CampaignMessageType;
  status: CampaignStatus;
  publisher?: string;
  isTrigger?: boolean;
  sendToAll: boolean;
  sendAfterCreate?: boolean;
  runSegment?: boolean;
  isRateLimit?: boolean;
  scheduleTo?: string;
  spreadSending?: number;
  sentContacts?: number;
  sentPercentage?: number;
  recurrenceCount?: number;
  campaignMessage?: CampaignMessage[];
  steps?: AudienceCard[];
  tags?: Record<string, { id: number; name: string }> | Array<{ id: number; name: string }>;
  labels?: { id: number; name: string }[];
  labelContent?: { id: number; name: string }[];
  recurrenceSettings?: RecurrenceSettings;
  testabScheduleTo?: string;
  testabScheduleEnd?: string;
  testabAudiencePercent?: number;
  testabCriteria?: 'open' | 'click';
  testabSentAfterTest?: boolean;
  confirmSaveDuplicate?: boolean;
  accountId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CampaignStatistics {
  sending: number;
  scheduled: number;
  completed: number;
}

export interface CampaignDetailedStatistics {
  campaignId: number;
  delivered?: number;
  deliveredRate?: number;
  openRate?: number;
  clickRate?: number;
  ctrOrRate?: number;
  unsubscribeRate?: number;
  bounceRate?: number;
  closeRate?: number;
  sentContacts?: number;
}

/** Redis /campaigns/statistics endpoint response — progress tracking only */
export interface CampaignRedisStatistics {
  id: number;
  sentContacts: number | string | null;
  sentPercentage: number | string | null;
}

/** Redis /campaigns/statistics-testab per-message stats (keyed by message ID) */
export interface TestAbMessageStats {
  open?: number | string;
  click?: number | string;
  delivered?: number | string;
  total?: number | string;
}

/** Dashboard /statistics/email (or /push) endpoint response — general aggregates */
export interface DashboardGeneralStats {
  delivered: number;
  open: number;
  click: number;
  unsubscribe: number;
  bounce: number;
  blocked: number;
  sent: number;
  close: number;
  unique_opens: number;
  unique_clicks: number;
}

/** Response from /statistics/email or /statistics/push with groupByCampaign: true */
export type BatchCampaignStats = Record<number, { general: DashboardGeneralStats }>;

export interface CampaignWithStats extends Campaign {
  deliveredRate: string;
  openRate: string;
  ctr: string;
  ctor: string;
  unsubscribeCount: number;
  bounceCount: number;
  /** Real-time sending progress (0–100) from Redis polling. undefined when not sending. */
  sendingProgress?: number;
}

export function formatRate(numerator: number, denominator: number): string {
  if (!denominator) return '0%';
  return `${((numerator / denominator) * 100).toFixed(2)}%`;
}

/** Spread sending options in minutes — full set matching Vue2 */
export const SPREAD_SENDING_OPTIONS = [
  { value: 10, labelKey: 'campaigns.spreadMinutes', labelParams: { count: 10 } },
  { value: 30, labelKey: 'campaigns.spreadMinutes', labelParams: { count: 30 } },
  { value: 60, labelKey: 'campaigns.spreadHour', labelParams: { count: 1 } },
  { value: 90, labelKey: 'campaigns.spreadHoursMinutes', labelParams: { hours: 1, minutes: 30 } },
  { value: 120, labelKey: 'campaigns.spreadHours', labelParams: { count: 2 } },
  { value: 150, labelKey: 'campaigns.spreadHoursMinutes', labelParams: { hours: 2, minutes: 30 } },
  { value: 180, labelKey: 'campaigns.spreadHours', labelParams: { count: 3 } },
  { value: 240, labelKey: 'campaigns.spreadHours', labelParams: { count: 4 } },
  { value: 300, labelKey: 'campaigns.spreadHours', labelParams: { count: 5 } },
  { value: 360, labelKey: 'campaigns.spreadHours', labelParams: { count: 6 } },
  { value: 420, labelKey: 'campaigns.spreadHours', labelParams: { count: 7 } },
  { value: 480, labelKey: 'campaigns.spreadHours', labelParams: { count: 8 } },
  { value: 540, labelKey: 'campaigns.spreadHours', labelParams: { count: 9 } },
  { value: 600, labelKey: 'campaigns.spreadHours', labelParams: { count: 10 } },
  { value: 660, labelKey: 'campaigns.spreadHours', labelParams: { count: 11 } },
  { value: 720, labelKey: 'campaigns.spreadHours', labelParams: { count: 12 } },
  { value: 1060, labelKey: 'campaigns.spreadHours', labelParams: { count: 18 } },
  { value: 1440, labelKey: 'campaigns.spreadHours', labelParams: { count: 24 } },
  { value: 0, labelKey: 'campaigns.spreadNone' },
] as const;

export const CHANNEL_OPTIONS = [
  { value: 'email' as const, labelKey: 'campaigns.channelEmail', icon: 'Mail' },
  { value: 'sms' as const, labelKey: 'campaigns.channelSms', icon: 'MessageSquare' },
  { value: 'web-push' as const, labelKey: 'campaigns.channelWebPush', icon: 'Bell' },
  { value: 'mobile-push' as const, labelKey: 'campaigns.channelMobilePush', icon: 'Smartphone' },
  { value: 'whatsapp' as const, labelKey: 'campaigns.channelWhatsapp', icon: 'Phone' },
] as const;

export const TYPE_OPTIONS = [
  { value: 'simple' as const, labelKey: 'campaigns.typeSimple', icon: 'Send' },
  {
    value: 'testAB' as const,
    labelKey: 'campaigns.typeTestAB',
    icon: 'FlaskConical',
    emailOnly: true,
  },
  { value: 'split' as const, labelKey: 'campaigns.typeSplit', icon: 'GitBranch', emailOnly: true },
  { value: 'recurring' as const, labelKey: 'campaigns.typeRecurring', icon: 'RefreshCw' },
] as const;
