export type ComparisonMessageType = 'email' | 'web-push';

export interface MessageMetrics {
  delivered: number;
  open: number;
  click: number;
  unsubscribe: number;
  bounce: number;
  blocked: number;
  sent: number;
  close: number;
  unique_opens?: number;
  unique_clicks?: number;
  [key: string]: number | undefined;
}

export interface MessageComparisonData {
  general: MessageMetrics;
  daily: Record<string, MessageMetrics & { date: string }>;
}

export type ComparisonResponse = Record<string, MessageComparisonData>;

export type MetricType = 'delivered' | 'open' | 'click' | 'ctor' | 'unsubscribe' | 'bounce' | 'sent' | 'close';
export type DisplayMode = 'numeric' | 'percentage';

export interface SelectedMessage {
  id: number;
  title: string;
}
