import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { EChartsBase } from '@/components/charts/echarts-base';
import type { PostmasterDate } from '../types';

interface DomainReputationChartProps {
  dates: PostmasterDate[];
}

const REPUTATION_MAP: Record<string, number> = {
  bad: 0,
  low: 1,
  medium: 2,
  high: 3,
};

export function DomainReputationChart({ dates }: DomainReputationChartProps) {
  const { t } = useTranslation();

  const option = useMemo(() => {
    const sorted = [...dates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const categories = sorted.map((d) => format(new Date(d.date + 'T12:00:00'), 'dd/MM'));
    const data = sorted.map((d) => REPUTATION_MAP[d.domainReputation?.toLowerCase()] ?? 0);

    const labels: Record<number, string> = {
      0: t('postmaster.reputation_bad'),
      1: t('postmaster.reputation_low'),
      2: t('postmaster.reputation_medium'),
      3: t('postmaster.reputation_high'),
    };

    return {
      tooltip: {
        trigger: 'axis' as const,
        valueFormatter: (v: number) => labels[v] ?? '',
      },
      grid: { left: 70, right: 20, top: 10, bottom: 30 },
      xAxis: { type: 'category' as const, data: categories },
      yAxis: {
        type: 'value' as const,
        min: 0,
        max: 3,
        interval: 1,
        axisLabel: { formatter: (v: number) => labels[v] ?? '' },
      },
      series: [
        {
          name: t('postmaster.domainReputation'),
          type: 'line' as const,
          color: '#0FB75C',
          data,
          symbol: 'circle',
          symbolSize: 4,
        },
      ],
    };
  }, [dates, t]);

  return <EChartsBase option={option} height={350} />;
}
