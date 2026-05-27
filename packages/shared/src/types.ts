// ── Event types ──
export const EMAIL_EVENTS = [
  'delivered',
  'bounce',
  'bounced',
  'deferred',
  'dropped',
  'spamreport',
  'open',
  'click',
  'unsubscribe',
  'group_unsubscribe',
] as const;

export type EmailEvent = (typeof EMAIL_EVENTS)[number];

// ── Aggregated stats row ──
export interface HourlyStats {
  hour: string;
  account_id: number;
  pool: string;
  provider_account: string;
  delivered: number;
  bounced: number;
  deferred: number;
  dropped: number;
  spam_reported: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  total_events: number;
}

export interface DailyStats {
  date: string;
  account_id: number;
  pool: string;
  provider_account: string;
  delivered: number;
  bounced: number;
  deferred: number;
  dropped: number;
  spam_reported: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  total_events: number;
}

// ── Dashboard ──
export interface HealthCard {
  label: string;
  value: number;
  previousValue: number;
  changePercent: number;
}

export interface DashboardOverview {
  healthCards: {
    sent: HealthCard;
    delivered: HealthCard;
    bounced: HealthCard;
    deferred: HealthCard;
    dropped: HealthCard;
  };
  deliveryRate: number;
  deliveryRateChange: number;
  volumeTimeline: HourlyStats[];
  badEventsTimeline: HourlyStats[];
  activeAlertCount: number;
  latestAlerts: Alert[];
  topOffenders: TopOffender[];
  timelineAlerts: Alert[];
}

export interface TopOffender {
  account_id: number;
  account_name: string;
  pool: string;
  sender_email: string;
  provider_account: string;
  total_delivered: number;
  total_bounced: number;
  total_deferred: number;
  total_dropped: number;
  bounce_rate: number;
  deferred_rate: number;
  dropped_rate: number;
}

// ── Alerts ──
export type AlertType =
  | 'bounce_spike'
  | 'deferred_spike'
  | 'volume_drop'
  | 'volume_spike'
  | 'spam_spike'
  | 'block_detected'
  | 'rate_limit'
  | 'default_no_rule';

export type AlertSeverity = 'warning' | 'critical';

/** Median + IQR-based statistical baseline for anomaly detection */
export interface StatisticalBaseline {
  median: number;
  spread: number; // IQR / 1.35 (normalized to stddev-equivalent)
  dataPoints: number;
}

export interface Alert {
  id: number;
  account_id: number | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string | null;
  metric_name: string | null;
  current_value: number | null;
  baseline_value: number | null;
  threshold_pct: number | null;
  pool: string | null;
  provider_account: string | null;
  detected_at: string;
  resolved_at: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AlertsResponse {
  alerts: Alert[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Reports ──
export interface AccountReport {
  account_id: number;
  delivered: number;
  bounced: number;
  deferred: number;
  dropped: number;
  spam_reported: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  total_events: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
}

export interface PoolReport {
  pool: string;
  account_id: number;
  delivered: number;
  bounced: number;
  deferred: number;
  dropped: number;
  spam_reported: number;
  opened: number;
  clicked: number;
  total_events: number;
  delivery_rate: number;
  bounce_rate: number;
}

export interface ProviderReport {
  provider_account: string;
  delivered: number;
  bounced: number;
  deferred: number;
  dropped: number;
  spam_reported: number;
  opened: number;
  clicked: number;
  total_events: number;
  delivery_rate: number;
  bounce_rate: number;
}

export interface IpReport {
  sending_ip: string;
  pool: string;
  sender_email: string;
  provider_account: string;
  account_id: number;
  delivered: number;
  bounced: number;
  deferred: number;
  spam_reported: number;
  opened: number;
  clicked: number;
  unsubscribe: number;
  total_events: number;
  delivery_rate: number;
  bounce_rate: number;
  open_rate: number;
  click_rate: number;
}

// ── Event Breakdown ──
export interface BreakdownRow {
  dimension: string;
  count: number;
  percentage: number;
}

export interface EventBreakdownResponse {
  eventType: string;
  total: number;
  byAccount: BreakdownRow[];
  bySender: BreakdownRow[];
  byProvider: BreakdownRow[];
  byCampaign: BreakdownRow[];
  byReason: BreakdownRow[];
  byEsp: BreakdownRow[];
}

// ── Filters ──
export interface ReportFilters {
  dateRange: DateRange;
  accountIds: number[];
  pools: string[];
  providerAccounts: string[];
  ips: string[];
}

export type DateRangePreset = '24h' | '7d' | '30d' | '90d' | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  from: string;
  to: string;
}

// ── Accounts / Pools (from PG) ──
export interface Account {
  id: number;
  name: string;
}

export interface Pool {
  id: number;
  account_id: number;
  name: string;
  ips: string[];
  sender_email: string | null;
  sending_limit: number | null;
  is_warmup: boolean;
}

// ── Routing Rules ──

export type RoutingProviderType = 'Gmail' | 'Yahoo' | 'Microsoft' | 'iCloud' | 'Other' | 'all';

export type RoutingMessageType = 'campaign' | 'journey' | 'transactional' | 'retargeting';

export type RoutingUserStatus = 'new' | 'old';

export type ExceptionTargetType = 'campaign' | 'automation' | 'segment' | 'label' | 'message';

export interface RoutingDistribution {
  accountId: string;
  senderId?: string;
  percentage: number;
}

export interface RoutingRuleFilters {
  provider?: RoutingProviderType;
  type?: RoutingMessageType;
  userStatus?: RoutingUserStatus;
  tags?: string[];
}

export interface RoutingNamedItem {
  id: string;
  name: string;
}

export interface RoutingExceptionTarget {
  campaigns?: RoutingNamedItem[];
  automations?: RoutingNamedItem[];
  segments?: RoutingNamedItem[];
  labels?: string[];
  messages?: RoutingNamedItem[];
}

export interface RoutingGeneralRule {
  id: string;
  name: string;
  filters: RoutingRuleFilters;
  distribution: RoutingDistribution[];
}

export interface RoutingExceptionRule extends RoutingGeneralRule {
  targetType: ExceptionTargetType;
  appliesTo: RoutingExceptionTarget;
  priority: number;
}

export interface RoutingDefaultConfig {
  accountId: string;
  senderId: string;
}

export interface RoutingRulesConfig {
  generalRule: RoutingGeneralRule[];
  exceptions: RoutingExceptionRule[];
  defaultConfig: RoutingDefaultConfig | null;
}

// ── Event detail ──
export interface EventDetail {
  time: string;
  account_id: number;
  event: string;
  email: string;
  contact_id: string;
  message_id: string;
  pool: string;
  sender_email: string;
  provider_account: string;
  ip: string;
  reason: string;
  campaign_id: string;
  automation_id: string;
}

export interface EventDetailResponse {
  events: EventDetail[];
  total: number;
  page: number;
  pageSize: number;
}
