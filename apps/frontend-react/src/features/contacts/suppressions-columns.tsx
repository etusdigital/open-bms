import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { SuppressedContact } from './types';
import type { SuppressionType } from './use-suppressions';
import { formatDateTime } from '@/lib/datetime';

const columnHelper = createColumnHelper<SuppressedContact>();

const selectColumn: ColumnDef<SuppressedContact, unknown> = {
  id: 'select',
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      aria-label="Select all"
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
      aria-label="Select row"
    />
  ),
  enableSorting: false,
  enableHiding: false,
};

interface UseSuppressionsColumnsOptions {
  onResubscribe: (email: string) => void;
  resubscribeDisabled?: boolean;
}

export function useSuppressionsColumns(
  type: SuppressionType,
  { onResubscribe, resubscribeDisabled = false }: UseSuppressionsColumnsOptions,
): ColumnDef<SuppressedContact, unknown>[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      [
        selectColumn,
        columnHelper.accessor('email', {
          header: t('contacts.email'),
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        }),
        columnHelper.accessor((row) => (type === 'unsubscribed' ? row.unsubscribedAt : row.blockedAt), {
          id: 'date',
          header: t('contacts.suppressionDate'),
          cell: (info) => <span className="text-muted-foreground text-sm">{formatDateTime(info.getValue())}</span>,
        }),
        columnHelper.display({
          id: 'actions',
          header: () => <span className="sr-only">{t('common.actions')}</span>,
          cell: (info) => (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                disabled={resubscribeDisabled}
                onClick={() => onResubscribe(info.row.original.email)}
                aria-label={t('contacts.resubscribeAction')}
                title={t('contacts.resubscribeAction')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ),
        }),
      ] as ColumnDef<SuppressedContact, unknown>[],
    [t, type, onResubscribe, resubscribeDisabled],
  );
}
