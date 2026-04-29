import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { useSuperAdminAccountsAll, useSuspendSuperAdminAccount, useDeleteSuperAdminAccount } from './use-super-admin-accounts';
import { useSuperAdminAccountsColumns } from './accounts-columns';
import type { SuperAdminAccount } from './types';

const EMPTY_ARRAY: SuperAdminAccount[] = [];

export default function SuperAdminAccountsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<SuperAdminAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminAccount | null>(null);

  const query = useSuperAdminAccountsAll();
  const suspendMutation = useSuspendSuperAdminAccount();
  const deleteMutation = useDeleteSuperAdminAccount();

  const allAccounts = query.data ?? EMPTY_ARRAY;

  const filtered = useMemo(() => {
    if (!search) return allAccounts;
    const lower = search.toLowerCase();
    return allAccounts.filter(
      (a) => a.name.toLowerCase().includes(lower) || a.description?.toLowerCase().includes(lower),
    );
  }, [allAccounts, search]);

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

  const columns = useSuperAdminAccountsColumns({ onSuspend: handleSuspend, onDelete: handleDelete });

  const table = useReactTable({
    columns,
    data: filtered,
    getCoreRowModel: getCoreRowModel(),
  });

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
    </>
  );
}
