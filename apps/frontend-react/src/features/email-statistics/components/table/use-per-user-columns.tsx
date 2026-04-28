import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import type { StatisticsTableRow } from '../../types';
import { METRIC_COLORS } from '../../constants';
import { formatDateFull } from '../../utils/format-date';
import { formatNumber } from '../../utils/format-number';
import { StatsCell } from './stats-cell';

export function usePerUserColumns(): ColumnDef<StatisticsTableRow, unknown>[] {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  return useMemo(
    () => [
      {
        accessorKey: 'date',
        header: t('statistics.date'),
        enableSorting: true,
        cell: ({ row }) => <span className="text-sm tabular-nums">{formatDateFull(row.original.date, locale)}</span>,
      },
      {
        accessorKey: 'unique_user_delivered',
        header: t('statistics.baseSize'),
        meta: { align: 'right', metricKey: 'unique_user_delivered' },
        enableSorting: true,
        cell: ({ row }) => (
          <div className="text-right text-sm tabular-nums">
            {formatNumber(row.original.unique_user_delivered ?? 0, locale)}
          </div>
        ),
      },
      {
        accessorKey: 'percentageUserOpen',
        header: t('statistics.engagedUsers'),
        meta: { metricKey: 'unique_user_open' },
        enableSorting: true,
        cell: ({ row }) => (
          <StatsCell
            rate={row.original.percentageUserOpen}
            count={row.original.unique_user_open}
            color={METRIC_COLORS.unique_user_open}
            locale={locale}
          />
        ),
      },
      {
        accessorKey: 'percentageUserClick',
        header: t('statistics.dau'),
        meta: { metricKey: 'unique_user_click' },
        enableSorting: true,
        cell: ({ row }) => (
          <StatsCell
            rate={row.original.percentageUserClick}
            count={row.original.unique_user_click}
            color={METRIC_COLORS.unique_user_click}
            locale={locale}
          />
        ),
      },
      {
        accessorKey: 'opens_per_contact',
        header: t('statistics.avgOpenRate'),
        meta: { align: 'right', metricKey: 'opens_per_contact' },
        enableSorting: true,
        cell: ({ row }) => <div className="text-right text-sm tabular-nums">{row.original.opens_per_contact}</div>,
      },
      {
        accessorKey: 'clicks_per_contact',
        header: t('statistics.avgClickRate'),
        meta: { align: 'right', metricKey: 'clicks_per_contact' },
        enableSorting: true,
        cell: ({ row }) => <div className="text-right text-sm tabular-nums">{row.original.clicks_per_contact}</div>,
      },
      {
        accessorKey: 'percentageUserUnsubscribe',
        header: t('statistics.unsubByBase'),
        meta: { metricKey: 'unique_user_unsubscribe' },
        enableSorting: true,
        cell: ({ row }) => (
          <StatsCell
            rate={row.original.percentageUserUnsubscribe}
            count={row.original.unique_user_unsubscribe}
            color={METRIC_COLORS.unique_user_unsubscribe}
            locale={locale}
          />
        ),
      },
    ],
    [t, locale],
  );
}
