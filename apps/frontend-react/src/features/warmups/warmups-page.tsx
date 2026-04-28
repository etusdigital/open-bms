import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { z } from 'zod';
import { Flame, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { useListSearchParams, listSearchSchema } from '@/hooks/use-list-search-params';
import { useAppStore, selectIsSuperAdmin } from '@/stores/app-store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWarmupsList, useDeleteWarmup } from './use-warmups';
import { useWarmupsColumns } from './warmups-columns';
import type { Warmup } from './types';
import { WARMUP_STATUSES } from './types';

export const warmupSearchSchema = listSearchSchema.extend({
  status: z.string().default('').catch(''),
});

export type WarmupSearchParams = z.infer<typeof warmupSearchSchema>;

const EMPTY_ARRAY: Warmup[] = [];

interface WarmupsPageProps {
  searchParams: WarmupSearchParams;
}

export default function WarmupsPage({ searchParams }: WarmupsPageProps) {
  const { t } = useTranslation();
  const isSuperAdmin = useAppStore(selectIsSuperAdmin);

  const navigate = useNavigate();

  const { pagination, sorting, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const statusFilter = searchParams.status;

  const setStatusFilter = useCallback(
    (value: string) => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          status: value,
          page: 1,
        }),
      } as never);
    },
    [navigate],
  );

  const query = useWarmupsList(searchParams, statusFilter || undefined);
  const deleteWarmup = useDeleteWarmup();

  const [deleteTarget, setDeleteTarget] = useState<Warmup | null>(null);

  const handleDelete = useCallback((warmup: Warmup) => {
    setDeleteTarget(warmup);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteWarmup.mutate(deleteTarget.id, {
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
  }, [deleteTarget, deleteWarmup, query.data?.data, searchParams.page, setPagination]);

  const columns = useWarmupsColumns({ onDelete: handleDelete, canDelete: isSuperAdmin });

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
        <ListPage.Header title={t('warmups.pageTitle')}>
          {isSuperAdmin && (
            <Button size="sm" asChild>
              <Link to="/warmups/create">
                <Plus className="mr-1 h-4 w-4" />
                {t('warmups.createWarmup')}
              </Link>
            </Button>
          )}
        </ListPage.Header>

        <ListPage.Toolbar>
          <DataTableSearch value={searchParams.search} onChange={setSearch} />
          <Select value={statusFilter || 'all'} onValueChange={(val) => setStatusFilter(val === 'all' ? '' : val)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('common.select')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all', 'Todos')}</SelectItem>
              {WARMUP_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`warmups.status${s.charAt(0).toUpperCase()}${s.slice(1)}` as 'warmups.statusRunning')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ListPage.Toolbar>

        {isEmpty ? (
          <ListPage.Empty>
            <DataTableEmptyState
              entityName={t('warmups.entityNamePlural')}
              hasSearch={searchParams.search.length > 0 || statusFilter.length > 0}
              onClearSearch={() => {
                setSearch('');
                setStatusFilter('');
              }}
              icon={Flame}
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
        title={t('common.deleteConfirmTitle', { entity: t('warmups.entityName') })}
        description={t('common.deleteConfirmMessage', {
          name: deleteTarget?.sender ?? '',
        })}
        onConfirm={confirmDelete}
        loading={deleteWarmup.isPending}
      />
    </>
  );
}
