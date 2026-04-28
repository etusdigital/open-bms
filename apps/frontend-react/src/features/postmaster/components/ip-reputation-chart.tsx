import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { EChartsBase } from '@/components/charts/echarts-base';
import type { PostmasterDate } from '../types';

interface IpReputationChartProps {
  dates: PostmasterDate[];
}

const REPUTATION_ORDER = ['bad', 'low', 'medium', 'high'] as const;
const COLORS = { bad: '#F03232', low: '#FF9654', medium: '#FFC500', high: '#0FB75C' };

export function IpReputationChart({ dates }: IpReputationChartProps) {
  const { t } = useTranslation();
  const [selectedPoint, setSelectedPoint] = useState<{
    date: string;
    reputation: string;
    ips: { ip: string; reputation: string }[];
  } | null>(null);

  const sortedDates = useMemo(
    () => [...dates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [dates],
  );

  const option = useMemo(() => {
    const categories = sortedDates.map((d) => {
      const dt = new Date(d.date + 'T12:00:00');
      return format(dt, 'dd/MM');
    });

    const series = REPUTATION_ORDER.map((rep) => ({
      name: t(`postmaster.reputation_${rep}`),
      type: 'bar' as const,
      stack: 'ip',
      color: COLORS[rep],
      data: sortedDates.map((d) => {
        const total = d.ips.length;
        if (total === 0) return 0;
        const count = d.ips.filter((ip) => ip.reputation.toLowerCase() === rep).length;
        return Math.round((count / total) * 100);
      }),
      label: {
        show: true,
        formatter: (params: { value: number }) => (params.value > 0 ? `${params.value}%` : ''),
      },
    }));

    return {
      tooltip: { trigger: 'axis' as const },
      legend: {
        data: REPUTATION_ORDER.map((r) => t(`postmaster.reputation_${r}`)),
        bottom: 0,
      },
      grid: { left: 50, right: 20, top: 10, bottom: 40 },
      xAxis: { type: 'category' as const, data: categories },
      yAxis: {
        type: 'value' as const,
        max: 100,
        axisLabel: { formatter: (v: number) => `${v}%` },
      },
      series,
    };
  }, [sortedDates, t]);

  const handleClick = useCallback(
    (...args: unknown[]) => {
      const params = args[0] as Record<string, unknown>;
      const dataIndex = params.dataIndex as number;
      const seriesIndex = params.seriesIndex as number;
      if (dataIndex == null || seriesIndex == null) return;

      const dateEntry = sortedDates[dataIndex];
      const reputation = REPUTATION_ORDER[seriesIndex];
      const filteredIps = dateEntry.ips.filter((ip) => ip.reputation.toLowerCase() === reputation);

      setSelectedPoint({
        date: dateEntry.date,
        reputation,
        ips: filteredIps,
      });
    },
    [sortedDates],
  );

  const events = useMemo(() => ({ click: handleClick }), [handleClick]);

  return (
    <div>
      <EChartsBase option={option} height={350} onEvents={events} />

      {selectedPoint && selectedPoint.ips.length > 0 ? (
        <div className="mt-4 rounded-md border p-4" data-testid="ip-detail">
          <p className="mb-2 text-sm font-semibold">
            {t('postmaster.ipsWithReputation', {
              reputation: t(`postmaster.reputation_${selectedPoint.reputation}` as never),
              date: format(new Date(selectedPoint.date + 'T12:00:00'), 'dd/MM/yyyy'),
            })}
          </p>
          <ul className="space-y-1">
            {selectedPoint.ips.map((ip) => (
              <li key={ip.ip} className="text-muted-foreground text-sm">
                {ip.ip}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground mt-4 text-center text-sm">{t('postmaster.clickPointIp')}</p>
      )}
    </div>
  );
}
