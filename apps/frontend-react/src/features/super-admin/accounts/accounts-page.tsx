import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable, type RowSelectionState } from '@tanstack/react-table';
import { Building2, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { useAppStore } from '@/stores/app-store';
import {
  useSuperAdminAccountsAll,
  useSuspendSuperAdminAccount,
  useDeleteSuperAdminAccount,
  useBulkDeleteSuperAdminAccounts,
} from './use-super-admin-accounts';
import { useSuperAdminAccountsColumns } from './accounts-columns';
import type { SuperAdminAccount } from './types';

const EMPTY_ARRAY: SuperAdminAccount[] = [];

export default function SuperAdminAccountsPage() {
  const { t } = useTranslation();
  const auth = useAppStore((s) => s.auth);
  const currentAccountId = auth.status === 'authenticated' ? auth.account.id : undefined;

  const [search, setSearch] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<SuperAdminAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminAccount | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const query = useSuperAdminAccountsAll();
  const suspendMutation = useSuspendSuperAdminAccount();
  const deleteMutation = useDeleteSuperAdminAccount();
  const bulkDelete = useBulkDeleteSuperAdminAccounts();

  const allAccounts = query.data ?? EMPTY_ARRAY;

  const filtered = useMemo(() => {
    if (!search) return allAccounts;
    const lower = search.toLowerCase();
    return allAccounts.filter(
      (a) => a.name.toLowerCase().includes(lower) || a.description?.toLowerCase().includes(lower),
    );
  }, [allAccounts, search]);

  // Clear selection when search changes
  const prevSearchRef = useRef(search);
  useEffect(() => {
    if (prevSearchRef.current !== search) {
      setRowSelection({});
    }
    prevSearchRef.current = search;
  }, [search]);

  const handleSuspend = useCallback((account: SuperAdminAccount) => {
    setSuspendTarget(account);
  }, []);

  const handleDelete = useCallback((account: SuperAdminAccount) => {
    setDeleteTarget(account);
  }, []);

  const confirmSuspend = useCallback(() => {
    if (!suspendTarget) return;
    suspendMutation.mutate(
      { id: suspendTarget.id, isActive: !suspendTarget.isActive },
      { onSuccess: () => setSuspendTarget(null) },
    );
  }, [suspendTarget, suspendMutation]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }, [deleteTarget, deleteMutation]);

  const columns = useSuperAdminAccountsColumns({
    onSuspend: handleSuspend,
    onDelete: handleDelete,
    currentAccountId,
    deleteDisabled: deleteMutation.isPending || bulkDelete.isPending,
  });

  const table = useReactTable({
    columns,
    data: filtered,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: (row) => row.original.id !== currentAccountId,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => String(row.id),
    state: { rowSelection },
  });

  const selectedIds = Object.keys(rowSelection)
    .filter((key) => rowSelection[key])
    .map(Number);
  const selectedCount = selectedIds.length;

  const isEmpty = !query.isLoading && filtered.length === 0;

  return (
    <>
      <ListPage.Root>
        <ListPage.Header title={t('superAdmin.accounts.pageTitle')}>
          <Button size="sm" asChild>
            <Link to="/super-admin/accounts/create">
              <Plus className="mr-1 h-4 w-4" />
              {t('superAdmin.accounts.createAccount')}
            </Link>
          </Button>
        </ListPage.Header>

        <ListPage.Toolbar>
          <DataTableSearch value={search} onChange={setSearch} />
        </ListPage.Toolbar>

        {selectedCount > 0 && (
          <div className="px-1 pb-2">
            <div className="bg-muted/50 flex items-center gap-3 rounded-md border px-4 py-2">
              <span className="text-sm font-medium">{t('common.bulkActionsSelected', { count: selectedCount })}</span>
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
                {t('common.clearSelection')}
              </Button>
            </div>
          </div>
        )}

        {isEmpty ? (
          <ListPage.Empty>
            <DataTableEmptyState
              entityName={t('superAdmin.accounts.entityNamePlural')}
              hasSearch={search.length > 0}
              onClearSearch={() => setSearch('')}
              icon={Building2}
            />
          </ListPage.Empty>
        ) : (
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
        )}
      </ListPage.Root>

      <ConfirmDialog
        open={suspendTarget !== null}
        onOpenChange={(open) => { if (!open) setSuspendTarget(null); }}
        title={
          suspendTarget?.isActive
            ? t('superAdmin.accounts.suspendConfirmTitle')
            : t('superAdmin.accounts.reactivateConfirmTitle')
        }
        description={
          suspendTarget?.isActive
            ? t('superAdmin.accounts.suspendConfirmMessage', { name: suspendTarget?.name ?? '' })
            : t('superAdmin.accounts.reactivateConfirmMessage', { name: suspendTarget?.name ?? '' })
        }
        onConfirm={confirmSuspend}
        loading={suspendMutation.isPending}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t('common.deleteConfirmTitle', { entity: t('superAdmin.accounts.entityName') })}
        description={t('superAdmin.accounts.deleteConfirmMessage', { name: deleteTarget?.name ?? '' })}
        onConfirm={confirmDelete}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={t('common.deleteConfirmTitle', { entity: t('superAdmin.accounts.entityNamePlural') })}
        description={t('superAdmin.accounts.bulkDeleteConfirmDescription', { count: selectedCount })}
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
    </>
  );
}
