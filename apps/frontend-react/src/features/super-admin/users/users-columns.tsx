import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SuperAdminUser } from './types';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

export function useSuperAdminUsersColumns(): ColumnDef<SuperAdminUser, unknown>[] {
  const { t } = useTranslation();

  return useMemo(
    () => [
      {
        accessorKey: 'name',
        header: t('superAdmin.users.name'),
        cell: ({ row }) => (
          <Link
            to="/super-admin/users/$userId"
            params={{ userId: String(row.original.id) }}
            className="text-primary font-medium hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'email',
        header: t('superAdmin.users.email'),
      },
      {
        accessorKey: 'globalRole',
        header: t('superAdmin.users.globalRole'),
        cell: ({ row }) =>
          row.original.globalRole ? (
            <Badge variant="outline">{row.original.globalRole.code}</Badge>
          ) : null,
      },
      {
        id: 'accounts',
        header: t('superAdmin.users.accounts'),
        cell: ({ row }) => row.original.userAccount?.length ?? 0,
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
      },
      {
        accessorKey: 'createdAt',
        header: t('common.createdAt'),
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs" asChild>
                    <Link
                      to="/super-admin/users/$userId"
                      params={{ userId: String(row.original.id) }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">{t('common.edit')}</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('common.edit')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ),
      },
    ],
    [t],
  );
}
