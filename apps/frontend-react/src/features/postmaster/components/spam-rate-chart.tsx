import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { EChartsBase } from '@/components/charts/echarts-base';
import type { PostmasterDate } from '../types';

interface SpamRateChartProps {
  dates: PostmasterDate[];
}

export function SpamRateChart({ dates }: SpamRateChartProps) {
  const { t } = useTranslation();

  const option = useMemo(() => {
    const sorted = [...dates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const categories = sorted.map((d) => format(new Date(d.date + 'T12:00:00'), 'dd/MM'));
    const data = sorted.map((d) => Number(d.spamRatio.toFixed(2)));

    return {
      tooltip: {
        trigger: 'axis' as const,
        valueFormatter: (v: number) => `${v}%`,
      },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: { type: 'category' as const, data: categories },
      yAxis: {
        type: 'value' as const,
        max: 5,
        min: 0,
        axisLabel: { formatter: (v: number) => `${v}%` },
      },
      series: [
        {
          name: t('postmaster.spamVolume'),
          type: 'line' as const,
          color: '#F03232',
          data,
          symbol: 'circle',
          symbolSize: 4,
        },
      ],
    };
  }, [dates, t]);

  return <EChartsBase option={option} height={350} />;
}
