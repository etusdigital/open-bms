import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Settings2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { useListSearchParams, type ListSearchParams } from '@/hooks/use-list-search-params';
import { usePermissions } from '@/hooks/use-permissions';
import { useCampaignConfigsList, useDeleteCampaignConfig, useDuplicateCampaignConfig } from './use-campaign-configs';
import { useCampaignConfigsColumns } from './campaign-configs-columns';
import type { CampaignConfig } from './types';

const EMPTY_ARRAY: CampaignConfig[] = [];

interface CampaignConfigsPageProps {
  searchParams: ListSearchParams;
}

export default function CampaignConfigsPage({ searchParams }: CampaignConfigsPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManage = can('infra:manage');

  const { pagination, sorting, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const query = useCampaignConfigsList(searchParams);
  const deleteMutation = useDeleteCampaignConfig();
  const duplicateMutation = useDuplicateCampaignConfig();

  const [deleteTarget, setDeleteTarget] = useState<CampaignConfig | null>(null);

  const handleDelete = useCallback((config: CampaignConfig) => {
    setDeleteTarget(config);
  }, []);

  const handleDuplicate = useCallback(
    (config: CampaignConfig) => {
      duplicateMutation.mutate(config.id, {
        onSuccess: (newConfig) => {
          navigate({
            to: '/campaign-rules/configs/$configId',
            params: { configId: String(newConfig.id) },
          });
        },
      });
    },
    [duplicateMutation, navigate],
  );

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

  const columns = useCampaignConfigsColumns({
    onDelete: handleDelete,
    onDuplicate: handleDuplicate,
    canManage,
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
        <ListPage.Header title={t('campaignRules.configsPageTitle')}>
          {canManage && (
            <Button size="sm" asChild>
              <Link to="/campaign-rules/configs/create">
                <Plus className="mr-1 h-4 w-4" />
                {t('campaignRules.createConfig')}
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
              entityName={t('campaignRules.configEntityNamePlural')}
              hasSearch={searchParams.search.length > 0}
              onClearSearch={() => setSearch('')}
              icon={Settings2}
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
        title={t('common.deleteConfirmTitle', { entity: t('campaignRules.configEntityName') })}
        description={t('common.deleteConfirmMessage', {
          name: deleteTarget?.name ?? '',
        })}
        onConfirm={confirmDelete}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
