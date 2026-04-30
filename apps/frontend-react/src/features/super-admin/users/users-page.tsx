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
import { useListSearchParams, type ListSearchParams } from '@/hooks/use-list-search-params';
import {
  useSuperAdminUsersList,
  useDeleteSuperAdminUser,
  useBulkDeleteSuperAdminUsers,
} from './use-super-admin-users';
import { useSuperAdminUsersColumns } from './users-columns';
import type { SuperAdminUser } from './types';

const EMPTY_ARRAY: SuperAdminUser[] = [];

interface SuperAdminUsersPageProps {
  searchParams: ListSearchParams;
}

export default function SuperAdminUsersPage({ searchParams }: SuperAdminUsersPageProps) {
  const { t } = useTranslation();
  const auth = useAppStore((s) => s.auth);
  const currentUserId = auth.status === 'authenticated' ? auth.user.id : undefined;

  const { pagination, sorting, searchParams: normalizedParams, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const query = useSuperAdminUsersList(normalizedParams);
  const deleteUser = useDeleteSuperAdminUser();
  const bulkDelete = useBulkDeleteSuperAdminUsers();

  const [deleteTarget, setDeleteTarget] = useState<SuperAdminUser | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columns = useSuperAdminUsersColumns({
    onDelete: setDeleteTarget,
    currentUserId,
    deleteDisabled: deleteUser.isPending || bulkDelete.isPending,
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
    enableRowSelection: (row) => row.original.id !== currentUserId,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => String(row.id),
    state: { pagination, sorting, rowSelection },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  // Clear selection when search/page changes
  const prevSearchRef = useRef(normalizedParams);
  useEffect(() => {
    const prev = prevSearchRef.current;
    if (
      prev.search !== normalizedParams.search ||
      prev.page !== normalizedParams.page ||
      prev.pageSize !== normalizedParams.pageSize
    ) {
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
      <ListPage.Header title={t('superAdmin.users.pageTitle')}>
        <Button size="sm" asChild>
          <Link to="/super-admin/users/create">
            <Plus className="mr-1 h-4 w-4" />
            {t('superAdmin.users.createUser')}
          </Link>
        </Button>
      </ListPage.Header>

      <ListPage.Toolbar>
        <DataTableSearch value={normalizedParams.search} onChange={setSearch} />
      </ListPage.Toolbar>

      {selectedCount > 0 && (
        <div className="px-1 pb-2">
          <div className="bg-muted/50 flex items-center gap-3 rounded-md border px-4 py-2">
            <span className="text-sm font-medium">{t('contacts.bulkActionsSelected', { count: selectedCount })}</span>
            <Separator orientation="vertical" className="h-5" />
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkDelete.isPending}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {t('common.delete')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-xs"
              onClick={() => setRowSelection({})}
              disabled={bulkDelete.isPending}
            >
              <X className="mr-1 h-3 w-3" />
              {t('contacts.clearSelection')}
            </Button>
          </div>
        </div>
      )}

      {isEmpty ? (
        <ListPage.Empty>
          <DataTableEmptyState
            entityName={t('superAdmin.users.entityNamePlural')}
            hasSearch={normalizedParams.search.length > 0}
            onClearSearch={() => setSearch('')}
            icon={Users}
          />
        </ListPage.Empty>
      ) : (
        <>
          <ListPage.Content>
            <DataTable
              columns={columns}
              table={table}
              isLoading={query.isLoading}
              isFetching={query.isFetching}
              error={query.error}
              onRetry={() => query.refetch()}
            />
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
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('common.deleteConfirmTitle', { entity: t('superAdmin.users.entityName') })}
        description={t('common.deleteConfirmMessage', { name: deleteTarget?.email ?? '' })}
        loading={deleteUser.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteUser.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
          });
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={t('common.deleteConfirmTitle', { entity: t('superAdmin.users.entityNamePlural') })}
        description={t('superAdmin.users.bulkDeleteConfirmDescription', { count: selectedCount })}
        loading={bulkDelete.isPending}
        onConfirm={() => {
          if (selectedIds.length === 0) return;
          bulkDelete.mutate(selectedIds, {
            onSuccess: () => {
              setBulkDeleteOpen(false);
              setRowSelection({});
            },
          });
        }}
      />
    </ListPage.Root>
  );
}
