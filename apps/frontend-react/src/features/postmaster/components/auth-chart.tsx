import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { EChartsBase } from '@/components/charts/echarts-base';
import type { PostmasterDate } from '../types';

interface AuthChartProps {
  dates: PostmasterDate[];
}

const AUTH_SERIES = [
  { key: 'dkimRatio' as const, label: 'DKIM', color: '#00CEFC' },
  { key: 'spfRatio' as const, label: 'SPF', color: '#50358A' },
  { key: 'dmarcRatio' as const, label: 'DMARC', color: '#FF9654' },
];

export function AuthChart({ dates }: AuthChartProps) {
  const { t } = useTranslation();

  const sortedDates = useMemo(
    () => [...dates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [dates],
  );

  const option = useMemo(() => {
    const categories = sortedDates.map((d) => format(new Date(d.date + 'T12:00:00'), 'dd/MM'));

    return {
      tooltip: {
        trigger: 'axis' as const,
        valueFormatter: (v: number) => `${v.toFixed(1)}%`,
      },
      legend: {
        data: AUTH_SERIES.map((s) => `${t('postmaster.successRate')} ${s.label}`),
        bottom: 0,
      },
      grid: { left: 50, right: 20, top: 10, bottom: 40 },
      xAxis: { type: 'category' as const, data: categories },
      yAxis: {
        type: 'value' as const,
        min: 0,
        max: 100,
        axisLabel: { formatter: (v: number) => `${v}%` },
      },
      series: AUTH_SERIES.map((s) => ({
        name: `${t('postmaster.successRate')} ${s.label}`,
        type: 'line' as const,
        color: s.color,
        data: sortedDates.map((d) => Number(d[s.key].toFixed(1))),
        symbol: 'circle',
        symbolSize: 4,
      })),
    };
  }, [sortedDates, t]);

  return (
    <div>
      <EChartsBase option={option} height={350} />

      {/* Auth data table */}
      <div className="mt-4 overflow-auto" data-testid="auth-table">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left font-semibold">{t('common.date', 'Data')}</th>
              {AUTH_SERIES.map((s) => (
                <th key={s.key} className="py-2 text-left font-semibold">
                  {t('postmaster.successRate')} {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedDates.map((d) => (
              <tr key={d.date} className="border-b">
                <td className="py-2">{format(new Date(d.date + 'T12:00:00'), 'dd/MM/yyyy')}</td>
                {AUTH_SERIES.map((s) => (
                  <td key={s.key} className="py-2">
                    {d[s.key].toFixed(1)}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
