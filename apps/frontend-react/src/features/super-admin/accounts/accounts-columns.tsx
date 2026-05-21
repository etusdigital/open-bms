import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2, PauseCircle, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SuperAdminAccount } from './types';
import { formatDateTime } from '@/lib/datetime';

interface UseAccountsColumnsOptions {
  onSuspend: (account: SuperAdminAccount) => void;
  onDelete: (account: SuperAdminAccount) => void;
  currentAccountId?: number;
  deleteDisabled?: boolean;
}

export function useSuperAdminAccountsColumns({
  onSuspend,
  onDelete,
  currentAccountId,
  deleteDisabled = false,
}: UseAccountsColumnsOptions): ColumnDef<SuperAdminAccount, unknown>[] {
  const { t } = useTranslation();

  return useMemo(
    () => [
      {
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
            disabled={row.original.id === currentAccountId}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'name',
        header: t('superAdmin.accounts.name'),
        cell: ({ row }) => (
          <Link
            to="/super-admin/accounts/$accountId"
            params={{ accountId: String(row.original.id) }}
            className="text-primary font-medium hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'isActive',
        header: t('superAdmin.accounts.status'),
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {t('superAdmin.accounts.active')}
            </Badge>
          ) : (
            <Badge variant="destructive">{t('superAdmin.accounts.suspended')}</Badge>
          ),
      },
      {
        accessorKey: 'isInternal',
        header: t('superAdmin.accounts.isInternal'),
        cell: ({ row }) =>
          row.original.isInternal ? (
            <Badge variant="outline">{t('superAdmin.accounts.internal')}</Badge>
          ) : null,
      },
      {
        accessorKey: 'createdAt',
        header: t('common.createdAt'),
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const account = row.original;
          const isCurrent = account.id === currentAccountId;
          const suspendLabel = account.isActive
            ? t('superAdmin.accounts.suspend')
            : t('superAdmin.accounts.reactivate');
          const deleteLabel = isCurrent ? t('superAdmin.accounts.cannotDeleteCurrent') : t('common.delete');

          return (
            <div className="flex justify-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link
                        to="/super-admin/accounts/$accountId"
                        params={{ accountId: String(account.id) }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">{t('common.edit')}</span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('common.edit')}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" onClick={() => onSuspend(account)}>
                      {account.isActive ? (
                        <PauseCircle className="h-3.5 w-3.5" />
                      ) : (
                        <PlayCircle className="h-3.5 w-3.5" />
                      )}
                      <span className="sr-only">{suspendLabel}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{suspendLabel}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(account)}
                      disabled={deleteDisabled || isCurrent}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">{deleteLabel}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{deleteLabel}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
      },
    ],
    [t, onSuspend, onDelete, currentAccountId, deleteDisabled],
  );
}
