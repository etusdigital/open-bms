import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TwoFAGroupRow } from './types';

function formatNumber(value: number): string {
  return value.toLocaleString();
}

interface UseTwoFAGroupsColumnsOptions {
  onGroupClick: (groupName: string) => void;
  onDelete: (groupName: string) => void;
  canDelete: boolean;
}

export function useTwoFAGroupsColumns({
  onGroupClick,
  onDelete,
  canDelete,
}: UseTwoFAGroupsColumnsOptions): ColumnDef<TwoFAGroupRow, unknown>[] {
  const { t } = useTranslation();

  return useMemo(() => {
    const columns: ColumnDef<TwoFAGroupRow, unknown>[] = [
      {
        accessorKey: 'groupName',
        header: t('twofaMessages.groupName'),
        cell: ({ row }) => (
          <button
            className="text-primary text-left text-sm font-medium hover:underline"
            onClick={() => onGroupClick(row.original.groupName)}
          >
            {row.original.groupName}
          </button>
        ),
      },
      {
        accessorKey: 'countSuccess',
        header: t('twofaMessages.successRequests'),
        cell: ({ row }) => <span className="text-sm font-medium">{formatNumber(row.original.countSuccess)}</span>,
      },
      {
        accessorKey: 'countError',
        header: t('twofaMessages.errorRequests'),
        cell: ({ row }) => <span className="text-sm font-medium">{formatNumber(row.original.countError)}</span>,
      },
      {
        accessorKey: 'countVerifyValidated',
        header: t('twofaMessages.validated2FA'),
        cell: ({ row }) => (
          <span className="text-sm font-medium">{formatNumber(row.original.countVerifyValidated)}</span>
        ),
      },
      {
        accessorKey: 'countVerifyRejected',
        header: t('twofaMessages.rejected2FA'),
        cell: ({ row }) => (
          <span className="text-sm font-medium">{formatNumber(row.original.countVerifyRejected)}</span>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex justify-end">
            {canDelete && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(row.original.groupName)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('common.deleteEntity', {
                      entity: t('twofaMessages.group'),
                    })}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ),
      },
    ];

    return columns;
  }, [t, onGroupClick, onDelete, canDelete]);
}
