import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Filter, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { useListSearchParams, type ListSearchParams } from '@/hooks/use-list-search-params';
import { usePermissions } from '@/hooks/use-permissions';
import { useSegmentsList, useDeleteSegment, useCopySegment, useRunSegment } from './use-segments';
import { useSegmentsColumns } from './segments-columns';
import { useColumnVisibility } from './use-column-visibility';
import { useSegmentProcessing } from './use-segment-processing';
import { ColumnVisibilityDialog } from './column-visibility-dialog';
import type { Segment } from './types';

const EMPTY_ARRAY: Segment[] = [];

interface SegmentsSearchParams extends ListSearchParams {
  status?: string;
}

interface SegmentsPageProps {
  searchParams: SegmentsSearchParams;
}

export default function SegmentsPage({ searchParams }: SegmentsPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canExecute = can('audience:segments_execute');

  const { pagination, sorting, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const statusFilter = searchParams.status ?? '';

  const setStatusFilter = useCallback(
    (value: string) => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          status: value === 'all' ? '' : value,
          page: 1,
        }),
      } as never);
    },
    [navigate],
  );

  const { visibility, updateVisibility } = useColumnVisibility();
  const { isProcessing: _isProcessing, startProcessing, processingIds } = useSegmentProcessing();

  const query = useSegmentsList(searchParams, statusFilter);
  const deleteSegment = useDeleteSegment();
  const copySegment = useCopySegment();
  const runSegment = useRunSegment();

  const [deleteTarget, setDeleteTarget] = useState<Segment | null>(null);
  const [runTarget, setRunTarget] = useState<Segment | null>(null);

  const handleDelete = useCallback((segment: Segment) => {
    setDeleteTarget(segment);
  }, []);

  const handleCopy = useCallback(
    (segment: Segment) => {
      copySegment.mutate(segment.id);
    },
    [copySegment],
  );

  const handleRun = useCallback((segment: Segment) => {
    setRunTarget(segment);
  }, []);

  const confirmRun = useCallback(() => {
    if (!runTarget) return;
    runSegment.mutate(runTarget.id, {
      onSuccess: () => {
        startProcessing(runTarget.id);
        setRunTarget(null);
      },
    });
  }, [runTarget, runSegment, startProcessing]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteSegment.mutate(deleteTarget.id, {
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
  }, [deleteTarget, deleteSegment, query.data?.data, searchParams.page, setPagination]);

  const columns = useSegmentsColumns({
    onDelete: handleDelete,
    onCopy: handleCopy,
    onRun: handleRun,
    canDelete: canExecute,
    canExecute,
    columnVisibility: visibility,
    processingIds,
  });

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
        <ListPage.Header title={t('segments.pageTitle')}>
          {canExecute && (
            <Button size="sm" asChild>
              <Link to="/segments/create">
                <Plus className="mr-1 h-4 w-4" />
                {t('segments.createSegment')}
              </Link>
            </Button>
          )}
        </ListPage.Header>

        <ListPage.Toolbar>
          <DataTableSearch value={searchParams.search} onChange={setSearch} />
          <Select value={statusFilter || 'all'} onValueChange={setStatusFilter}>
            <SelectTrigger size="sm" className="w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                {t('common.all', 'Todos')}
              </SelectItem>
              <SelectItem value="active" className="text-xs">
                {t('segments.statusFilterActive', 'Ativos')}
              </SelectItem>
              <SelectItem value="inactive" className="text-xs">
                {t('segments.statusFilterInactive', 'Inativos')}
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <ColumnVisibilityDialog visibility={visibility} onSave={updateVisibility} />
          </div>
        </ListPage.Toolbar>

        {isEmpty ? (
          <ListPage.Empty>
            <DataTableEmptyState
              entityName={t('segments.entityNamePlural')}
              hasSearch={searchParams.search.length > 0}
              onClearSearch={() => setSearch('')}
              icon={Filter}
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
        title={t('common.deleteConfirmTitle', { entity: t('segments.entityName') })}
        description={t('common.deleteConfirmMessage', {
          name: deleteTarget?.name ?? '',
        })}
        onConfirm={confirmDelete}
        loading={deleteSegment.isPending}
      />

      <ConfirmDialog
        open={runTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRunTarget(null);
        }}
        title={t('segments.runConfirmTitle')}
        description={t('segments.runConfirmMessage', {
          name: runTarget?.name ?? '',
        })}
        onConfirm={confirmRun}
        loading={runSegment.isPending}
        variant="default"
      />
    </>
  );
}
