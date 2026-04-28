import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Scale, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { useListSearchParams, type ListSearchParams } from '@/hooks/use-list-search-params';
import { usePermissions } from '@/hooks/use-permissions';
import { useCampaignRulesList, useDeleteCampaignRule } from './use-campaign-rules';
import { useCampaignRulesColumns } from './campaign-rules-columns';
import type { CampaignRule } from './types';

const EMPTY_ARRAY: CampaignRule[] = [];

interface CampaignRulesPageProps {
  searchParams: ListSearchParams;
}

export default function CampaignRulesPage({ searchParams }: CampaignRulesPageProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canManage = can('infra:manage');

  const { pagination, sorting, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const query = useCampaignRulesList(searchParams);
  const deleteMutation = useDeleteCampaignRule();

  const [deleteTarget, setDeleteTarget] = useState<CampaignRule | null>(null);

  const handleDelete = useCallback((rule: CampaignRule) => {
    setDeleteTarget(rule);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
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
  }, [deleteTarget, deleteMutation, query.data?.data, searchParams.page, setPagination]);

  const columns = useCampaignRulesColumns({ onDelete: handleDelete, canDelete: canManage });

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
        <ListPage.Header title={t('campaignRules.rulesPageTitle')}>
          {canManage && (
            <Button size="sm" asChild>
              <Link to="/campaign-rules/rules/create">
                <Plus className="mr-1 h-4 w-4" />
                {t('campaignRules.createRule')}
              </Link>
            </Button>
          )}
        </ListPage.Header>

        <ListPage.Toolbar>
          <DataTableSearch value={searchParams.search} onChange={setSearch} />
        </ListPage.Toolbar>

        {isEmpty ? (
          <ListPage.Empty>
            <DataTableEmptyState
              entityName={t('campaignRules.entityNamePlural')}
              hasSearch={searchParams.search.length > 0}
              onClearSearch={() => setSearch('')}
              icon={Scale}
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
        title={t('common.deleteConfirmTitle', { entity: t('campaignRules.entityName') })}
        description={t('common.deleteConfirmMessage', {
          name: deleteTarget?.name ?? '',
        })}
        onConfirm={confirmDelete}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
