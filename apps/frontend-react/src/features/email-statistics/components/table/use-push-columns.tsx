import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import type { StatisticsTableRow } from '../../types';
import { METRIC_COLORS, PUSH_DELIVERED_COLOR } from '../../constants';
import { formatDateFull } from '../../utils/format-date';
import { formatNumber } from '../../utils/format-number';
import { StatsCell } from './stats-cell';

export function usePushColumns(isWebPush: boolean): ColumnDef<StatisticsTableRow, unknown>[] {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  return useMemo(() => {
    const cols: ColumnDef<StatisticsTableRow, unknown>[] = [
      {
        accessorKey: 'date',
        header: t('statistics.date'),
        enableSorting: true,
        cell: ({ row }) => <span className="text-sm tabular-nums">{formatDateFull(row.original.date, locale)}</span>,
      },
      {
        accessorKey: 'sent',
        header: t('statistics.sent'),
        meta: { align: 'right', metricKey: 'sent' },
        enableSorting: true,
        cell: ({ row }) => (
          <div className="text-right text-sm tabular-nums">{formatNumber(row.original.sent ?? 0, locale)}</div>
        ),
      },
      {
        accessorKey: 'percentageDelivered',
        header: t('statistics.delivered'),
        meta: { metricKey: 'delivered' },
        enableSorting: true,
        cell: ({ row }) => (
          <StatsCell
            rate={row.original.percentageDelivered}
            count={row.original.delivered}
            color={PUSH_DELIVERED_COLOR}
            locale={locale}
          />
        ),
      },
      {
        accessorKey: 'percentageClick',
        header: t('statistics.click'),
        meta: { metricKey: 'click' },
        enableSorting: true,
        cell: ({ row }) => (
          <StatsCell
            rate={row.original.percentageClick}
            count={row.original.click}
            color={METRIC_COLORS.click}
            locale={locale}
          />
        ),
      },
    ];

    if (isWebPush) {
      cols.push({
        accessorKey: 'percentageClose',
        header: t('statistics.close'),
        meta: { metricKey: 'close' },
        enableSorting: true,
        cell: ({ row }) => (
          <StatsCell
            rate={row.original.percentageClose}
            count={row.original.close}
            color={METRIC_COLORS.close}
            locale={locale}
          />
        ),
      });
    }

    return cols;
  }, [t, isWebPush, locale]);
}
