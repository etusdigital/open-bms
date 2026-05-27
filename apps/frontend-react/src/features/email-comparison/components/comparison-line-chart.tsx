import { useMemo } from 'react';
import { EChartsBase } from '@/components/charts/echarts-base';
import { formatDateShort } from '@/features/email-statistics/utils/format-date';
import type { ComparisonResponse, MetricType, DisplayMode, SelectedMessage } from '../types';
import { getMetricValue } from '../metric-utils';

const COLORS = [
  '#00CEFC',
  '#009BE4',
  '#436BBA',
  '#4515AB',
  '#50358A',
  '#4A004F',
  '#8C0758',
  '#C6315C',
  '#F06158',
  '#FF9654',
];

interface ComparisonLineChartProps {
  data: ComparisonResponse;
  messages: SelectedMessage[];
  metric: MetricType;
  displayMode: DisplayMode;
}

export function ComparisonLineChart({ data, messages, metric, displayMode }: ComparisonLineChartProps) {
  const option = useMemo(() => {
    // Collect all unique ISO dates from the date field inside each daily entry
    const dateMap = new Map<string, string>(); // ISO date → display label
    messages.forEach((m) => {
      const msgData = data[String(m.id)];
      if (msgData?.daily) {
        for (const entry of Object.values(msgData.daily)) {
          if (entry?.date) {
            const iso = entry.date;
            if (!dateMap.has(iso)) {
              dateMap.set(iso, formatDateShort(iso, 'pt-BR'));
            }
          }
        }
      }
    });

    // Sort by ISO date ascending
    const sortedISODates = [...dateMap.keys()].sort();
    const categories = sortedISODates.map((iso) => dateMap.get(iso)!);

    // Build a lookup from ISO date → daily key for each message
    const series = messages.map((m, i) => {
      const msgData = data[String(m.id)];
      // Build a map from ISO date → entry for this message
      const entryByDate = new Map<string, Record<string, unknown>>();
      if (msgData?.daily) {
        for (const entry of Object.values(msgData.daily)) {
          if (entry?.date) {
            entryByDate.set(entry.date, entry);
          }
        }
      }

      return {
        name: m.title,
        type: 'line' as const,
        smooth: 0.3,
        showSymbol: sortedISODates.length <= 2,
        symbolSize: 6,
        emphasis: { focus: 'series' as const },
        lineStyle: { width: 2, color: COLORS[i % COLORS.length] },
        itemStyle: { color: COLORS[i % COLORS.length] },
        data: sortedISODates.map((iso) => {
          const dayData = entryByDate.get(iso);
          if (!dayData) return 0;
          return getMetricValue(dayData as any, metric, displayMode);
        }),
      };
    });

    return {
      tooltip: {
        trigger: 'axis' as const,
        valueFormatter: (v: number) => (displayMode === 'percentage' ? `${v.toFixed(1)}%` : v.toLocaleString()),
      },
      legend: {
        show: true,
        bottom: 0,
      },
      grid: { left: 50, right: 20, top: 10, bottom: 40 },
      xAxis: { type: 'category' as const, data: categories },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          formatter: (v: number) => (displayMode === 'percentage' ? `${v}%` : v.toLocaleString()),
        },
      },
      series,
    };
  }, [data, messages, metric, displayMode]);

  return (
    <div data-testid="comparison-line-chart">
      <EChartsBase option={option} height={345} />
    </div>
  );
}
