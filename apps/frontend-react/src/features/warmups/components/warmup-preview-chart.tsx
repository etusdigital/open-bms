import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EChartsBase } from '@/components/charts/echarts-base';
import { WARMUP_LIMITS, WARMUP_COLORS, getWarmupDayForTarget } from '../constants';

interface WarmupPreviewChartProps {
  selectedTarget: number | null;
}

export function WarmupPreviewChart({ selectedTarget }: WarmupPreviewChartProps) {
  const { t } = useTranslation();

  const option = useMemo(() => {
    const days = Array.from({ length: 25 }, (_, i) => String(i + 1));
    const targetDay = selectedTarget ? getWarmupDayForTarget(selectedTarget) : 0;

    return {
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: Array<{ dataIndex: number; value: number }>) => {
          const p = params[0];
          return `${t('warmups.warmupDay', { day: p.dataIndex + 1 })}: ${p.value.toLocaleString()}`;
        },
      },
      grid: { left: 60, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'category' as const, data: days },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          formatter: (v: number) => {
            if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
            return String(v);
          },
        },
      },
      series: [
        {
          name: t('warmups.warmupEstimate'),
          type: 'line' as const,
          data: [...WARMUP_LIMITS],
          color: WARMUP_COLORS.estimate,
          lineStyle: { type: 'dashed' as const },
          smooth: true,
          symbol: 'none',
          markPoint:
            targetDay > 0
              ? {
                  data: [
                    {
                      coord: [targetDay - 1, selectedTarget],
                      symbolSize: 20,
                      symbol: 'pin',
                      itemStyle: { color: '#7B61FF' },
                    },
                  ],
                }
              : undefined,
        },
      ],
    };
  }, [selectedTarget, t]);

  return <EChartsBase option={option} height={300} />;
}
