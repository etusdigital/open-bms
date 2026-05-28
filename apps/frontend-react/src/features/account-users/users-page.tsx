// Adapted from features/super-admin/users — keep in sync until shared module is extracted.
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable, type RowSelectionState } from '@tanstack/react-table';
import { Users, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ListPage } from '@/components/list-page';
import { useAppStore } from '@/stores/app-store';
import { usePermissions } from '@/hooks/use-permissions';
import { useAccountId } from '@/features/settings/use-settings';
import { useListSearchParams, type ListSearchParams } from '@/hooks/use-list-search-params';
import { useAccountUsersList, useRemoveAccountMembership, useBulkRemoveAccountMembership } from './use-account-users';
import { useAccountUsersColumns } from './users-columns';
import type { AccountUser } from './types';

const EMPTY_ARRAY: AccountUser[] = [];

interface AccountUsersPageProps {
  searchParams: ListSearchParams;
}

export default function AccountUsersPage({ searchParams }: AccountUsersPageProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const auth = useAppStore((s) => s.auth);
  const currentUserId = auth.status === 'authenticated' ? auth.user.id : undefined;
  const activeAccountId = useAccountId();
  const accountName = auth.status === 'authenticated' ? auth.account.name : '';

  const canInvite = can('account:users_invite');
  const canManage = can('account:users_update_roles');

  const { pagination, sorting, searchParams: normalizedParams, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const query = useAccountUsersList(normalizedParams);
  const removeMembership = useRemoveAccountMembership();
  const bulkRemove = useBulkRemoveAccountMembership();

  const [removeTarget, setRemoveTarget] = useState<AccountUser | null>(null);
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columns = useAccountUsersColumns({
    onRemove: setRemoveTarget,
    currentUserId,
    activeAccountId,
    removeDisabled: removeMembership.isPending || bulkRemove.isPending,
    canManage,
  });

  const data = query.data?.data ?? EMPTY_ARRAY;
  const totalRows = query.data?.meta.total ?? 0;
  const totalPages = Math.ceil(totalRows / normalizedParams.pageSize);

  const table = useReactTable({
    columns,
    data,
    rowCount: totalRows,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: (row) => canManage && row.original.id !== currentUserId,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => String(row.id),
    state: { pagination, sorting, rowSelection },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  const prevSearchRef = useRef(normalizedParams);
  useEffect(() => {
    const prev = prevSearchRef.current;
    if (prev.search !== normalizedParams.search || prev.page !== normalizedParams.page || prev.pageSize !== normalizedParams.pageSize) {
      setRowSelection({});
    }
    prevSearchRef.current = normalizedParams;
  }, [normalizedParams]);

  const selectedIds = Object.keys(rowSelection)
    .filter((key) => rowSelection[key])
    .map(Number);
  const selectedCount = selectedIds.length;

  const isEmpty = !query.isLoading && data.length === 0;

  return (
    <ListPage.Root>
      <ListPage.Header title={t('account.users.pageTitle')}>
        {canInvite && (
          <Button size="sm" asChild>
            <Link to="/settings/users/create">
              <Plus className="mr-1 h-4 w-4" />
              {t('account.users.inviteButton')}
            </Link>
          </Button>
        )}
      </ListPage.Header>

      <ListPage.Toolbar>
        <DataTableSearch value={normalizedParams.search} onChange={setSearch} />
      </ListPage.Toolbar>

      {canManage && selectedCount > 0 && (
        <div className="px-1 pb-2">
          <div className="bg-muted/50 flex items-center gap-3 rounded-md border px-4 py-2">
            <span className="text-sm font-medium">{t('common.bulkActionsSelected', { count: selectedCount })}</span>
            <Separator orientation="vertical" className="h-5" />
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setBulkRemoveOpen(true)} disabled={bulkRemove.isPending}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {t('account.users.actions.remove')}
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setRowSelection({})} disabled={bulkRemove.isPending}>
              <X className="mr-1 h-3 w-3" />
              {t('common.clearSelection')}
            </Button>
          </div>
        </div>
      )}

      {isEmpty ? (
        <ListPage.Empty>
          <DataTableEmptyState
            entityName={t('account.users.entityNamePlural')}
            hasSearch={normalizedParams.search.length > 0}
            onClearSearch={() => setSearch('')}
            icon={Users}
          />
        </ListPage.Empty>
      ) : (
        <>
          <ListPage.Content>
            <DataTable columns={columns} table={table} isLoading={query.isLoading} isFetching={query.isFetching} error={query.error} onRetry={() => query.refetch()} />
          </ListPage.Content>

          <ListPage.Pagination>
            <DataTablePagination
              currentPage={normalizedParams.page}
              totalPages={totalPages}
              pageSize={normalizedParams.pageSize}
              totalRows={totalRows}
              onPageChange={(page) => setPagination((prev) => ({ ...prev, pageIndex: page - 1 }))}
              onPageSizeChange={(size) => setPagination({ pageIndex: 0, pageSize: size })}
            />
          </ListPage.Pagination>
        </>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title={t('account.users.confirmRemove.title')}
        description={t('account.users.confirmRemove.message', { name: removeTarget?.name ?? removeTarget?.email ?? '', account: accountName })}
        confirmLabel={t('account.users.confirmRemove.confirmButton')}
        loading={removeMembership.isPending}
        onConfirm={() => {
          if (!removeTarget) return;
          removeMembership.mutate(removeTarget.id, {
            onSuccess: () => setRemoveTarget(null),
          });
        }}
      />

      <ConfirmDialog
        open={bulkRemoveOpen}
        onOpenChange={setBulkRemoveOpen}
        title={t('account.users.confirmRemove.title')}
        description={t('account.users.confirmRemove.bulkMessage', { count: selectedCount, account: accountName })}
        confirmLabel={t('account.users.confirmRemove.confirmButton')}
        loading={bulkRemove.isPending}
        onConfirm={() => {
          if (selectedIds.length === 0) return;
          bulkRemove.mutate(selectedIds, {
            onSuccess: () => {
              setBulkRemoveOpen(false);
              setRowSelection({});
            },
          });
        }}
      />
    </ListPage.Root>
  );
}
