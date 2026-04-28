import { useMemo } from 'react';
import { EChartsBase } from '@/components/charts/echarts-base';
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

interface ComparisonBarChartProps {
  data: ComparisonResponse;
  messages: SelectedMessage[];
  metric: MetricType;
  displayMode: DisplayMode;
}

export function ComparisonBarChart({ data, messages, metric, displayMode }: ComparisonBarChartProps) {
  const option = useMemo(() => {
    const categories = messages.map((m) => m.title);
    const values = messages.map((m) => {
      const msgData = data[String(m.id)];
      if (!msgData) return 0;
      return getMetricValue(msgData.general, metric, displayMode);
    });

    return {
      tooltip: {
        trigger: 'axis' as const,
        valueFormatter: (v: number) => (displayMode === 'percentage' ? `${v.toFixed(1)}%` : v.toLocaleString()),
      },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: {
        type: 'category' as const,
        data: categories,
        axisLabel: { fontSize: 11, interval: 0, rotate: categories.length > 5 ? 15 : 0 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          formatter: (v: number) => (displayMode === 'percentage' ? `${v}%` : v.toLocaleString()),
        },
      },
      series: [
        {
          type: 'bar' as const,
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: COLORS[i % COLORS.length] },
          })),
          barMaxWidth: 40,
        },
      ],
    };
  }, [data, messages, metric, displayMode]);

  return (
    <div data-testid="comparison-bar-chart">
      <EChartsBase option={option} height={345} />
    </div>
  );
}
