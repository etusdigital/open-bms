import type { MessageType } from './types';

export interface MetricDefinition {
  key: string;
  titleKey: string;
  color: string;
  types: MessageType[];
  percentageOf?: 'delivered' | 'open';
}

/** Metric colors matching Vue 2 Dashboard.vue:1221-1334 */
export const METRIC_COLORS = {
  delivered: '#0057f4',
  open: '#0FB75C',
  unique_opens: '#076e62',
  click: '#00cefc',
  unique_clicks: '#436bba',
  percentageCtor: '#800080',
  unsubscribe: '#f06158',
  bounce: '#ff9654',
  sent: '#0057f4',
  close: '#f06158',
  percentageUto: '#F06158',
  // Per-user mode
  unique_user_delivered: '#0057f4',
  unique_user_open: '#0FB75C',
  unique_user_click: '#00cefc',
  opens_per_contact: '#B0E2C7',
  clicks_per_contact: '#98C7FD',
  unique_user_unsubscribe: '#f06158',
} as const;

/** Push type uses green for delivered instead of blue */
export const PUSH_DELIVERED_COLOR = '#0FB75C';

export const EMAIL_METRICS: MetricDefinition[] = [
  {
    key: 'delivered',
    titleKey: 'statistics.delivered',
    color: METRIC_COLORS.delivered,
    types: ['email'],
  },
  {
    key: 'open',
    titleKey: 'statistics.open',
    color: METRIC_COLORS.open,
    types: ['email'],
    percentageOf: 'delivered',
  },
  {
    key: 'unique_opens',
    titleKey: 'statistics.uniqueOpen',
    color: METRIC_COLORS.unique_opens,
    types: ['email'],
    percentageOf: 'delivered',
  },
  {
    key: 'click',
    titleKey: 'statistics.click',
    color: METRIC_COLORS.click,
    types: ['email'],
    percentageOf: 'delivered',
  },
  {
    key: 'unique_clicks',
    titleKey: 'statistics.uniqueClick',
    color: METRIC_COLORS.unique_clicks,
    types: ['email'],
    percentageOf: 'delivered',
  },
  {
    key: 'percentageCtor',
    titleKey: 'statistics.ctor',
    color: METRIC_COLORS.percentageCtor,
    types: ['email'],
    percentageOf: 'open',
  },
  {
    key: 'unsubscribe',
    titleKey: 'statistics.unsubscribe',
    color: METRIC_COLORS.unsubscribe,
    types: ['email'],
    percentageOf: 'delivered',
  },
  {
    key: 'bounce',
    titleKey: 'statistics.bounce',
    color: METRIC_COLORS.bounce,
    types: ['email'],
    percentageOf: 'delivered',
  },
];

export const PUSH_METRICS: MetricDefinition[] = [
  { key: 'sent', titleKey: 'statistics.sent', color: METRIC_COLORS.sent, types: ['web-push'] },
  {
    key: 'delivered',
    titleKey: 'statistics.delivered',
    color: PUSH_DELIVERED_COLOR,
    types: ['web-push'],
    percentageOf: 'delivered',
  },
  {
    key: 'click',
    titleKey: 'statistics.click',
    color: METRIC_COLORS.click,
    types: ['web-push'],
    percentageOf: 'delivered',
  },
  {
    key: 'close',
    titleKey: 'statistics.close',
    color: METRIC_COLORS.close,
    types: ['web-push'],
    percentageOf: 'delivered',
  },
];

export const PER_USER_METRICS: MetricDefinition[] = [
  {
    key: 'unique_user_delivered',
    titleKey: 'statistics.baseSize',
    color: METRIC_COLORS.unique_user_delivered,
    types: ['email', 'web-push'],
  },
  {
    key: 'unique_user_open',
    titleKey: 'statistics.engagedUsers',
    color: METRIC_COLORS.unique_user_open,
    types: ['email', 'web-push'],
  },
  {
    key: 'unique_user_click',
    titleKey: 'statistics.dau',
    color: METRIC_COLORS.unique_user_click,
    types: ['email', 'web-push'],
  },
  {
    key: 'opens_per_contact',
    titleKey: 'statistics.avgOpenRate',
    color: METRIC_COLORS.opens_per_contact,
    types: ['email', 'web-push'],
  },
  {
    key: 'clicks_per_contact',
    titleKey: 'statistics.avgClickRate',
    color: METRIC_COLORS.clicks_per_contact,
    types: ['email', 'web-push'],
  },
  {
    key: 'unique_user_unsubscribe',
    titleKey: 'statistics.unsubByBase',
    color: METRIC_COLORS.unique_user_unsubscribe,
    types: ['email'],
  },
];

/** Y-axis number formatter — abbreviates large numbers */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(value);
}

/** Safe percentage: (partial / total) * 100, returns 0 if total is 0 */
export function getPercentage(partial: number, total: number): number {
  if (!partial || !total || total === 0) return 0;
  return parseFloat(((partial / total) * 100).toFixed(2));
}
