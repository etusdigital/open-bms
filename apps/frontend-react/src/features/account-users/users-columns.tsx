// Adapted from features/super-admin/users — keep in sync until shared module is extracted.
import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDateTime } from '@/lib/datetime';
import type { AccountUser } from './types';

interface UseAccountUsersColumnsOptions {
  onRemove: (user: AccountUser) => void;
  currentUserId?: number;
  activeAccountId?: number;
  removeDisabled?: boolean;
  canManage?: boolean;
}

export function useAccountUsersColumns({
  onRemove,
  currentUserId,
  activeAccountId,
  removeDisabled = false,
  canManage = false,
}: UseAccountUsersColumnsOptions): ColumnDef<AccountUser, unknown>[] {
  const { t } = useTranslation();

  return useMemo(() => {
    const columns: ColumnDef<AccountUser, unknown>[] = [];

    if (canManage) {
      columns.push({
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
      });
    }

    columns.push(
      {
        accessorKey: 'name',
        header: t('account.users.columns.name'),
        // Self-edit is blocked (anti-self-modify) — render the own row as a plain span (F6).
        cell: ({ row }) =>
          canManage && row.original.id !== currentUserId ? (
            <Link
              to="/settings/users/$userId"
              params={{ userId: String(row.original.id) }}
              className="text-primary font-medium hover:underline"
            >
              {row.original.name}
            </Link>
          ) : (
            <span className="font-medium">{row.original.name}</span>
          ),
      },
      {
        accessorKey: 'email',
        header: t('account.users.columns.email'),
      },
      {
        id: 'role',
        header: t('account.users.columns.role'),
        cell: ({ row }) => {
          const membership = row.original.userAccount?.find((m) => m.accountId === activeAccountId);
          const code = membership?.roleOverride?.code;
          return code ? <Badge variant="outline">{code}</Badge> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
      },
      {
        accessorKey: 'createdAt',
        header: t('common.createdAt'),
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
    );

    if (canManage) {
      columns.push({
        id: 'actions',
        cell: ({ row }) => {
          const isSelf = row.original.id === currentUserId;
          return (
            <div className="flex justify-end gap-1">
              <TooltipProvider>
                {/* Self-edit is blocked (anti-self-modify) — hide the edit action on own row (F6). */}
                {!isSelf && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-xs" asChild>
                        <Link to="/settings/users/$userId" params={{ userId: String(row.original.id) }}>
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">{t('account.users.actions.edit')}</span>
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('account.users.actions.edit')}</TooltipContent>
                  </Tooltip>
                )}
                {!isSelf && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onRemove(row.original)}
                        disabled={removeDisabled}
                        aria-label={t('account.users.actions.remove')}
                      >
                        <Trash2 className="text-destructive h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('account.users.actions.remove')}</TooltipContent>
                  </Tooltip>
                )}
              </TooltipProvider>
            </div>
          );
        },
      });
    }

    return columns;
  }, [t, onRemove, currentUserId, activeAccountId, removeDisabled, canManage]);
}
