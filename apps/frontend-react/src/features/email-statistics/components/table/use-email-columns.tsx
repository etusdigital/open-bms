import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import type { StatisticsTableRow } from '../../types';
import { METRIC_COLORS } from '../../constants';
import { formatDateFull } from '../../utils/format-date';
import { formatNumber } from '../../utils/format-number';
import { StatsCell } from './stats-cell';

export function useEmailColumns(): ColumnDef<StatisticsTableRow, unknown>[] {
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
        accessorKey: 'delivered',
        header: t('statistics.delivered'),
        meta: { align: 'right', metricKey: 'delivered' },
        enableSorting: true,
        cell: ({ row }) => (
          <div className="text-right text-sm tabular-nums">{formatNumber(row.original.delivered ?? 0, locale)}</div>
        ),
      },
      {
        accessorKey: 'percentageOpen',
        header: t('statistics.open'),
        meta: { metricKey: 'open' },
        enableSorting: true,
        cell: ({ row }) => (
          <StatsCell
            rate={row.original.percentageOpen}
            count={row.original.open}
            color={METRIC_COLORS.open}
            locale={locale}
          />
        ),
      },
      {
        accessorKey: 'percentageUniqueOpen',
        header: t('statistics.uniqueOpen'),
        meta: { metricKey: 'unique_opens' },
        enableSorting: true,
        cell: ({ row }) => (
          <StatsCell
            rate={row.original.percentageUniqueOpen}
            count={row.original.unique_opens}
            color={METRIC_COLORS.unique_opens}
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
      {
        accessorKey: 'percentageUniqueClick',
        header: t('statistics.uniqueClick'),
        meta: { metricKey: 'unique_clicks' },
        enableSorting: true,
        cell: ({ row }) => (
          <StatsCell
            rate={row.original.percentageUniqueClick}
            count={row.original.unique_clicks}
            color={METRIC_COLORS.unique_clicks}
            locale={locale}
          />
        ),
      },
      {
        accessorKey: 'percentageCtor',
        header: t('statistics.ctor'),
        meta: { metricKey: 'percentageCtor' },
        enableSorting: true,
        cell: ({ row }) => (
          <StatsCell rate={row.original.percentageCtor} color={METRIC_COLORS.percentageCtor} locale={locale} />
        ),
      },
      {
        accessorKey: 'percentageUnsubscribe',
        header: t('statistics.unsubscribe'),
        meta: { metricKey: 'unsubscribe' },
        enableSorting: true,
        cell: ({ row }) => (
          <StatsCell
            rate={row.original.percentageUnsubscribe}
            count={row.original.unsubscribe}
            color={METRIC_COLORS.unsubscribe}
            locale={locale}
          />
        ),
      },
      {
        accessorKey: 'percentageUto',
        header: t('statistics.uto' as never),
        meta: { metricKey: 'percentageUto' },
        enableSorting: true,
        cell: ({ row }) => (
          <StatsCell rate={row.original.percentageUto} color={METRIC_COLORS.percentageUto} locale={locale} />
        ),
      },
      {
        accessorKey: 'percentageBounce',
        header: t('statistics.bounce'),
        meta: { metricKey: 'bounce' },
        enableSorting: true,
        cell: ({ row }) => (
          <StatsCell
            rate={row.original.percentageBounce}
            count={row.original.bounce}
            color={METRIC_COLORS.bounce}
            locale={locale}
          />
        ),
      },
    ],
    [t, locale],
  );
}
