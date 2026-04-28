import type { WarmupStatisticsDaily, WarmupDailyTableRow } from './types';

export function getPercentage(partial: number, total: number): string {
  if (!partial || partial === 0) return '0';
  if (!total || total === 0) return '0';
  return ((partial / total) * 100).toFixed(2);
}

export function transformDailyData(daily: WarmupStatisticsDaily[]): WarmupDailyTableRow[] {
  return [...daily]
    .filter((item) => item.date != null && (item.delivered || item.sent || item.open))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((item) => ({
      ...item,
      delivered: item.delivered ?? 0,
      open: item.open ?? 0,
      click: item.click ?? 0,
      bounce: item.bounce ?? 0,
      unsubscribe: item.unsubscribe ?? 0,
      sent: item.sent ?? 0,
      formattedDate: new Date(item.date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
      percentageOpen: getPercentage(item.open, item.delivered),
      percentageClick: getPercentage(item.click, item.delivered),
      percentageCtor: getPercentage(item.click, item.open),
      percentageUto: getPercentage(item.unsubscribe, item.open),
      percentageUnsubscribe: getPercentage(item.unsubscribe, item.delivered),
      percentageBounce: getPercentage(item.bounce, item.delivered),
    }));
}
