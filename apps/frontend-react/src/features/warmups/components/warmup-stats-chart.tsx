import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EChartsBase } from '@/components/charts/echarts-base';
import type { WarmupDailyTableRow } from '../types';
import { WARMUP_COLORS } from '../constants';

interface WarmupStatsChartProps {
  dailyData: WarmupDailyTableRow[];
  warmupLimits: number[];
  target: number;
  isPercentage: boolean;
}

export function WarmupStatsChart({ dailyData, warmupLimits, target, isPercentage }: WarmupStatsChartProps) {
  const { t } = useTranslation();

  // Single-pass extraction of all series arrays from dailyData
  const { dates, delivered, open, click, unsubscribe, bounce, pctOpen, pctClick, pctUnsubscribe, pctBounce } =
    useMemo(() => {
      const _dates: string[] = [];
      const _delivered: number[] = [];
      const _open: number[] = [];
      const _click: number[] = [];
      const _unsubscribe: number[] = [];
      const _bounce: number[] = [];
      const _pctOpen: number[] = [];
      const _pctClick: number[] = [];
      const _pctUnsubscribe: number[] = [];
      const _pctBounce: number[] = [];

      for (const d of dailyData) {
        _dates.push(new Date(d.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }));
        _delivered.push(d.delivered);
        _open.push(d.open);
        _click.push(d.click);
        _unsubscribe.push(d.unsubscribe);
        _bounce.push(d.bounce);
        _pctOpen.push(Number(d.percentageOpen));
        _pctClick.push(Number(d.percentageClick));
        _pctUnsubscribe.push(Number(d.percentageUnsubscribe));
        _pctBounce.push(Number(d.percentageBounce));
      }

      return {
        dates: _dates,
        delivered: _delivered,
        open: _open,
        click: _click,
        unsubscribe: _unsubscribe,
        bounce: _bounce,
        pctOpen: _pctOpen,
        pctClick: _pctClick,
        pctUnsubscribe: _pctUnsubscribe,
        pctBounce: _pctBounce,
      };
    }, [dailyData]);

  const option = useMemo(() => {
    if (isPercentage) {
      return {
        tooltip: { trigger: 'axis' as const },
        legend: { show: true, bottom: 0 },
        grid: { left: 60, right: 20, top: 20, bottom: 50 },
        xAxis: { type: 'category' as const, data: dates },
        yAxis: {
          type: 'value' as const,
          min: 0,
          max: 100,
          axisLabel: { formatter: (v: number) => `${v}%` },
        },
        series: [
          {
            name: t('warmups.open'),
            type: 'line' as const,
            data: pctOpen,
            color: WARMUP_COLORS.open,
            smooth: true,
          },
          {
            name: t('warmups.click'),
            type: 'line' as const,
            data: pctClick,
            color: WARMUP_COLORS.click,
            smooth: true,
          },
          {
            name: t('warmups.unsubscribeShort'),
            type: 'line' as const,
            data: pctUnsubscribe,
            color: WARMUP_COLORS.unsubscribe,
            smooth: true,
          },
          {
            name: t('warmups.bounce'),
            type: 'line' as const,
            data: pctBounce,
            color: WARMUP_COLORS.bounce,
            smooth: true,
          },
        ],
      };
    }

    return {
      tooltip: { trigger: 'axis' as const },
      legend: { show: true, bottom: 0 },
      grid: { left: 60, right: 20, top: 20, bottom: 50 },
      xAxis: { type: 'category' as const, data: dates },
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
          data: warmupLimits,
          color: WARMUP_COLORS.estimate,
          lineStyle: { type: 'dashed' as const },
          smooth: true,
          symbol: 'none',
          markPoint:
            target > 0
              ? {
                  data: [
                    {
                      coord: [dates.length - 1, target],
                      symbolSize: 20,
                      symbol: 'pin',
                      itemStyle: { color: WARMUP_COLORS.estimate },
                    },
                  ],
                }
              : undefined,
        },
        {
          name: t('warmups.delivered'),
          type: 'line' as const,
          data: delivered,
          color: WARMUP_COLORS.delivered,
          smooth: true,
        },
        {
          name: t('warmups.open'),
          type: 'line' as const,
          data: open,
          color: WARMUP_COLORS.open,
          smooth: true,
        },
        {
          name: t('warmups.click'),
          type: 'line' as const,
          data: click,
          color: WARMUP_COLORS.click,
          smooth: true,
        },
        {
          name: t('warmups.unsubscribeShort'),
          type: 'line' as const,
          data: unsubscribe,
          color: WARMUP_COLORS.unsubscribe,
          smooth: true,
        },
        {
          name: t('warmups.bounce'),
          type: 'line' as const,
          data: bounce,
          color: WARMUP_COLORS.bounce,
          smooth: true,
        },
      ],
    };
  }, [
    isPercentage,
    dates,
    delivered,
    open,
    click,
    unsubscribe,
    bounce,
    pctOpen,
    pctClick,
    pctUnsubscribe,
    pctBounce,
    warmupLimits,
    target,
    t,
  ]);

  return <EChartsBase option={option} height={350} />;
}
