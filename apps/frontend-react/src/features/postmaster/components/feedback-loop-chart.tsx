import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { EChartsBase } from '@/components/charts/echarts-base';
import type { PostmasterDate } from '../types';

interface FeedbackLoopChartProps {
  dates: PostmasterDate[];
}

export function FeedbackLoopChart({ dates }: FeedbackLoopChartProps) {
  const { t } = useTranslation();
  const [selectedPoint, setSelectedPoint] = useState<{
    date: string;
    loops: { id: string; spamRatio: number }[];
  } | null>(null);

  const sortedDates = useMemo(
    () => [...dates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [dates],
  );

  const option = useMemo(() => {
    const categories = sortedDates.map((d) => format(new Date(d.date + 'T12:00:00'), 'dd/MM'));

    return {
      tooltip: { trigger: 'axis' as const },
      legend: {
        data: [t('postmaster.spamVolume'), t('postmaster.numIdentifiers')],
        bottom: 0,
      },
      grid: { left: 50, right: 20, top: 10, bottom: 40 },
      xAxis: { type: 'category' as const, data: categories },
      yAxis: {
        type: 'value' as const,
        min: 0,
      },
      series: [
        {
          name: t('postmaster.spamVolume'),
          type: 'line' as const,
          color: '#F03232',
          data: sortedDates.map((d) => Number(d.spamRatio.toFixed(2))),
          symbol: 'circle',
          symbolSize: 4,
        },
        {
          name: t('postmaster.numIdentifiers'),
          type: 'bar' as const,
          color: '#7B61FF',
          data: sortedDates.map((d) => d.spamLoops?.length ?? 0),
        },
      ],
    };
  }, [sortedDates, t]);

  const handleClick = useCallback(
    (...args: unknown[]) => {
      const params = args[0] as Record<string, unknown>;
      const dataIndex = params.dataIndex as number;
      if (dataIndex == null) return;
      const dateEntry = sortedDates[dataIndex];
      setSelectedPoint({
        date: dateEntry.date,
        loops:
          dateEntry.spamLoops?.map((loop) => ({
            id: loop.id,
            spamRatio: loop.spamRatio * 100,
          })) ?? [],
      });
    },
    [sortedDates],
  );

  const events = useMemo(() => ({ click: handleClick }), [handleClick]);

  return (
    <div>
      <EChartsBase option={option} height={350} onEvents={events} />

      {selectedPoint && selectedPoint.loops.length > 0 ? (
        <div className="mt-4 rounded-md border p-4" data-testid="feedback-loop-detail">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-semibold">
                  {t('postmaster.flaggedIdentifiers', {
                    date: format(new Date(selectedPoint.date + 'T12:00:00'), 'dd/MM/yyyy'),
                  })}
                </th>
                <th className="py-2 text-left font-semibold">{t('postmaster.chartType_spam')}</th>
              </tr>
            </thead>
            <tbody>
              {selectedPoint.loops.map((loop) => (
                <tr key={loop.id} className="border-b">
                  <td className="text-muted-foreground py-2">{loop.id}</td>
                  <td className="text-muted-foreground py-2">{loop.spamRatio}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground mt-4 text-center text-sm">{t('postmaster.clickPointData')}</p>
      )}
    </div>
  );
}
