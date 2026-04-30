import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SuperAdminUser } from './types';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

interface UseSuperAdminUsersColumnsOptions {
  onDelete: (user: SuperAdminUser) => void;
  currentUserId?: number;
  deleteDisabled?: boolean;
}

export function useSuperAdminUsersColumns({
  onDelete,
  currentUserId,
  deleteDisabled = false,
}: UseSuperAdminUsersColumnsOptions): ColumnDef<SuperAdminUser, unknown>[] {
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
            disabled={row.original.id === currentUserId}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
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
        cell: ({ row }) => row.original.accountsCount ?? row.original.userAccount?.length ?? 0,
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
        cell: ({ row }) => {
          const isSelf = row.original.id === currentUserId;
          return (
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onDelete(row.original)}
                      disabled={deleteDisabled || isSelf}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="text-destructive h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isSelf ? t('superAdmin.users.cannotDeleteSelf') : t('common.delete')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
      },
    ],
    [t, onDelete, currentUserId, deleteDisabled],
  );
}
