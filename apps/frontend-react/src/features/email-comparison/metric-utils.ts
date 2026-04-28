import type { MessageMetrics, MetricType, DisplayMode } from './types';

export function getMetricValue(metrics: MessageMetrics, metricType: MetricType, displayMode: DisplayMode): number {
  if (metricType === 'ctor') {
    const opens = metrics.open || 0;
    if (opens === 0) return 0;
    return Number(((metrics.click / opens) * 100).toFixed(2));
  }

  const raw = metrics[metricType] ?? 0;

  if (displayMode === 'percentage') {
    const delivered = metrics.delivered || 0;
    if (delivered === 0) return 0;
    return Number(((raw / delivered) * 100).toFixed(2));
  }

  return raw;
}
