import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListPage } from '@/components/list-page';
import { EChartsBase } from '@/components/charts/echarts-base';
import { useInsights } from './use-insights';
import { formatDateShort } from '@/features/email-statistics/utils/format-date';
import { formatCompact } from '@/features/email-statistics/constants';
import {
  INSIGHTS_PERIODS,
  INSIGHTS_METRICS,
  HOURS,
  type InsightsPeriod,
  type InsightsMetricKey,
  type InsightsDayData,
} from './types';

// Colors assigned from the end so today/yesterday keep the same colors
// regardless of whether the view shows 2 days (48h) or 8 days (7d).
// Index 0 = oldest day, last index = today.
const DAY_COLORS = ['#0057f4', '#00cefc', '#ff9654', '#f06158', '#800080', '#436bba', '#0FB75C', '#C6315C'];

/** Get color for a day based on its position from the end (today = last color) */
function getDayColor(dayIndex: number, totalDays: number): string {
  const offset = DAY_COLORS.length - totalDays;
  return DAY_COLORS[(offset + dayIndex) % DAY_COLORS.length];
}

const LEGEND_ICON = 'path://M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10s10-4.48,10-10S17.52,2,12,2z';

function buildChartOption(days: InsightsDayData[], metricKey: InsightsMetricKey, locale: string) {
  const totalDays = days.length;
  const series = days.map((day, i) => {
    const hourlyData = day[metricKey] as Record<string, number> | undefined;
    const data = HOURS.map((_, h) => {
      const hourKey = String(h).padStart(2, '0');
      return hourlyData?.[hourKey] ?? 0;
    });
    const color = getDayColor(i, totalDays);

    return {
      name: formatDateShort(day.date, locale),
      type: 'line' as const,
      smooth: 0.3,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { width: 2, color },
      itemStyle: { color },
      data,
    };
  });

  return {
    tooltip: { trigger: 'axis' as const },
    legend: {
      show: true,
      bottom: 0,
      icon: LEGEND_ICON,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: 11 },
    },
    grid: { left: 12, right: 12, top: 10, bottom: 40, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: HOURS,
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { fontSize: 10, formatter: (v: number) => formatCompact(v) },
      splitLine: { lineStyle: { type: 'dashed' as const, color: 'rgba(0,0,0,0.06)' } },
    },
    series,
  };
}

interface InsightsPageProps {
  period: InsightsPeriod;
}

export default function InsightsPage({ period }: InsightsPageProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const query = useInsights(period);
  const locale = i18n.language;

  const setPeriod = useCallback(
    (value: InsightsPeriod) => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({ ...prev, period: value }),
      } as never);
    },
    [navigate],
  );

  const days = useMemo(() => {
    if (!query.data || !Array.isArray(query.data)) return [];
    return query.data.filter((d) => !!d.date);
  }, [query.data]);

  return (
    <ListPage.Root>
      <ListPage.Header title={t('insights.pageTitle')} />

      <ListPage.Toolbar>
        <Select value={period} onValueChange={(v) => setPeriod(v as InsightsPeriod)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INSIGHTS_PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {t(p.label as never)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ListPage.Toolbar>

      <div>
        {query.isLoading ? (
          <div className="grid gap-6 p-0 md:grid-cols-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="bg-muted h-[300px] animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : days.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
            <TrendingUp className="mb-4 h-12 w-12" />
            <p>{t('insights.noData')}</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {INSIGHTS_METRICS.map((metric) => (
              <Card key={metric.key}>
                <CardContent className="pt-4">
                  <h3 className="mb-2 text-sm font-semibold">{t(metric.titleKey as never)}</h3>
                  <EChartsBase option={buildChartOption(days, metric.key, locale)} height={300} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ListPage.Root>
  );
}
