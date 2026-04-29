import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2, PauseCircle, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SuperAdminAccount } from './types';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

interface UseAccountsColumnsOptions {
  onSuspend: (account: SuperAdminAccount) => void;
  onDelete: (account: SuperAdminAccount) => void;
}

export function useSuperAdminAccountsColumns({
  onSuspend,
  onDelete,
}: UseAccountsColumnsOptions): ColumnDef<SuperAdminAccount, unknown>[] {
  const { t } = useTranslation();

  return useMemo(
    () => [
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
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const account = row.original;
          const suspendLabel = account.isActive
            ? t('superAdmin.accounts.suspend')
            : t('superAdmin.accounts.reactivate');

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
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">{t('common.delete')}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('common.delete')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
      },
    ],
    [t, onSuspend, onDelete],
  );
}
