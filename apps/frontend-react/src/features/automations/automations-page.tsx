import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Workflow, Plus } from 'lucide-react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { useListSearchParams } from '@/hooks/use-list-search-params';
import { usePermissions } from '@/hooks/use-permissions';
import { useAutomationsList, useDeleteAutomation, useDuplicateAutomation } from './use-automations';
import { useAutomationsColumns } from './automations-columns';
import type { Automation } from './types';
import type { AutomationsSearchParams } from '@/routes/_authenticated/_layout/automations/index';

const EMPTY_ARRAY: Automation[] = [];

interface AutomationsPageProps {
  searchParams: AutomationsSearchParams;
}

export default function AutomationsPage({ searchParams }: AutomationsPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('automations:create');
  const canDelete = can('automations:delete');

  const { pagination, sorting, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const query = useAutomationsList(searchParams);
  const deleteAutomation = useDeleteAutomation();
  const duplicateAutomation = useDuplicateAutomation();

  const [deleteTarget, setDeleteTarget] = useState<Automation | null>(null);

  const handleDelete = useCallback((automation: Automation) => {
    setDeleteTarget(automation);
  }, []);

  const handleDuplicate = useCallback(
    (automation: Automation) => {
      duplicateAutomation.mutate(automation.id);
    },
    [duplicateAutomation],
  );

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteAutomation.mutate(deleteTarget.id, {
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
  }, [deleteTarget, deleteAutomation, query.data?.data, searchParams.page, setPagination]);

  const columns = useAutomationsColumns({
    onDelete: handleDelete,
    onDuplicate: handleDuplicate,
    canDelete,
    canCreate,
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
        <ListPage.Header title={t('automations.pageTitle')} />

        <ListPage.Toolbar>
          <DataTableSearch value={searchParams.search} onChange={setSearch} />
          <Select
            value={searchParams.status}
            onValueChange={(value: AutomationsSearchParams['status']) => {
              void navigate({
                to: '.',
                search: (prev: Record<string, unknown>) => ({
                  ...prev,
                  status: value,
                  page: 1,
                }),
              } as never);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t('automations.active')}</SelectItem>
              <SelectItem value="inactive">{t('automations.inactive')}</SelectItem>
              <SelectItem value="all">{t('common.all')}</SelectItem>
            </SelectContent>
          </Select>
          {canCreate && (
            <Button asChild>
              <Link to="/automations/create">
                <Plus className="mr-2 h-4 w-4" />
                {t('common.create')}
              </Link>
            </Button>
          )}
        </ListPage.Toolbar>

        {isEmpty ? (
          <ListPage.Empty>
            <DataTableEmptyState
              entityName={t('automations.entityNamePlural')}
              hasSearch={searchParams.search.length > 0}
              onClearSearch={() => setSearch('')}
              icon={Workflow}
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
        title={t('common.deleteConfirmTitle', { entity: t('automations.entityName') })}
        description={t('common.deleteConfirmMessage', {
          name: deleteTarget?.title ?? '',
        })}
        onConfirm={confirmDelete}
        loading={deleteAutomation.isPending}
      />
    </>
  );
}
