export type InsightsPeriod = 'last48' | 'last7';

export const INSIGHTS_PERIODS: { value: InsightsPeriod; label: string }[] = [
  { value: 'last48', label: 'insights.period48h' },
  { value: 'last7', label: 'insights.period7d' },
];

/** Raw API response: array of daily objects with hourly breakdowns per metric */
export type InsightsApiResponse = InsightsDayData[];

export interface InsightsDayData {
  date: string;
  delivered?: Record<string, number>;
  open?: Record<string, number>;
  click?: Record<string, number>;
  unsubscribe?: Record<string, number>;
  bounce?: Record<string, number>;
  [key: string]: string | Record<string, number> | undefined;
}

export type InsightsMetricKey = 'delivered' | 'open' | 'click' | 'unsubscribe' | 'bounce';

export const INSIGHTS_METRICS: { key: InsightsMetricKey; titleKey: string }[] = [
  { key: 'delivered', titleKey: 'insights.delivered' },
  { key: 'open', titleKey: 'insights.open' },
  { key: 'click', titleKey: 'insights.click' },
  { key: 'unsubscribe', titleKey: 'insights.unsubscribe' },
  { key: 'bounce', titleKey: 'insights.bounce' },
];

/** 24 hours for the X-axis */
export const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}H`);
