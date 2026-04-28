import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import type { SuppressedContact } from './types';
import type { SuppressionType } from './use-suppressions';

const columnHelper = createColumnHelper<SuppressedContact>();

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
}

export function useSuppressionsColumns(type: SuppressionType): ColumnDef<SuppressedContact, unknown>[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      [
        columnHelper.accessor('email', {
          header: t('contacts.email'),
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        }),
        columnHelper.accessor((row) => (type === 'unsubscribed' ? row.unsubscribedAt : row.blockedAt), {
          id: 'date',
          header: t('contacts.suppressionDate'),
          cell: (info) => <span className="text-muted-foreground text-sm">{formatDate(info.getValue())}</span>,
        }),
      ] as ColumnDef<SuppressedContact, unknown>[],
    [t, type],
  );
}
