import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { useListSearchParams, type ListSearchParams } from '@/hooks/use-list-search-params';
import { usePermissions } from '@/hooks/use-permissions';
import { useSendersList, useDeleteSender, useSyncSenders } from './use-senders';
import { useSendersColumns } from './senders-columns';
import type { Sender } from './types';

const EMPTY_ARRAY: Sender[] = [];

interface SendersPageProps {
  searchParams: ListSearchParams;
}

export default function SendersPage({ searchParams }: SendersPageProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canManage = can('infra:manage');

  const { pagination, sorting, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const query = useSendersList(searchParams);
  const deleteSender = useDeleteSender();
  const syncSenders = useSyncSenders();

  const [deleteTarget, setDeleteTarget] = useState<Sender | null>(null);

  const handleDelete = useCallback((sender: Sender) => {
    setDeleteTarget(sender);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteSender.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        const data = query.data?.data ?? [];
        if (data.length === 1 && searchParams.page > 1) {
          setPagination((prev) => ({
            ...prev,
            pageIndex: prev.pageIndex - 1,
          }));
        }
      },
    });
  }, [deleteTarget, deleteSender, query.data?.data, searchParams.page, setPagination]);

  const columns = useSendersColumns({ onDelete: handleDelete, canDelete: canManage });

  const data = query.data?.data ?? EMPTY_ARRAY;
  const totalRows = query.data?.meta.total ?? 0;
  const totalPages = Math.ceil(totalRows / searchParams.pageSize);

  const table = useReactTable({
    columns,
    data,
    rowCount: totalRows,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  const isEmpty = !query.isLoading && data.length === 0;

  return (
    <>
      <ListPage.Root>
        <ListPage.Header title={t('senders.pageTitle')}>
          {canManage && (
            <Button size="sm" onClick={() => syncSenders.mutate()} disabled={syncSenders.isPending}>
              <RefreshCw className="mr-1 h-4 w-4" />
              {t('senders.sync')}
            </Button>
          )}
        </ListPage.Header>

        <ListPage.Toolbar>
          <DataTableSearch value={searchParams.search} onChange={setSearch} />
        </ListPage.Toolbar>

        {isEmpty ? (
          <ListPage.Empty>
            <DataTableEmptyState
              entityName={t('senders.entityNamePlural')}
              hasSearch={searchParams.search.length > 0}
              onClearSearch={() => setSearch('')}
              icon={Mail}
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
                currentPage={searchParams.page}
                totalPages={totalPages}
                pageSize={searchParams.pageSize}
                totalRows={totalRows}
                onPageChange={(page) => setPagination((prev) => ({ ...prev, pageIndex: page - 1 }))}
                onPageSizeChange={(size) => setPagination({ pageIndex: 0, pageSize: size })}
              />
            </ListPage.Pagination>
          </>
        )}
      </ListPage.Root>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('common.deleteConfirmTitle', { entity: t('senders.entityName') })}
        description={t('common.deleteConfirmMessage', {
          name: deleteTarget?.senderName ?? '',
        })}
        onConfirm={confirmDelete}
        loading={deleteSender.isPending}
      />
    </>
  );
}
