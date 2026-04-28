import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Zap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { useListSearchParams, type ListSearchParams } from '@/hooks/use-list-search-params';
import { usePermissions } from '@/hooks/use-permissions';
import {
  useTriggerCampaignsList,
  useDeleteTriggerCampaign,
  useTriggerCampaignListStats,
} from './use-trigger-campaigns';
import type { CampaignWithStats } from '@/features/campaigns/types';
import { useTriggerCampaignsColumns } from './trigger-campaigns-columns';
const EMPTY_ARRAY: CampaignWithStats[] = [];

interface TriggerCampaignsPageProps {
  searchParams: ListSearchParams;
}

export default function TriggerCampaignsPage({ searchParams }: TriggerCampaignsPageProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canCreate = can('campaigns:create');
  const canDelete = can('campaigns:delete');

  const { pagination, sorting, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const query = useTriggerCampaignsList(searchParams);
  const deleteCampaign = useDeleteTriggerCampaign();
  const rawCampaigns = query.data?.data ?? EMPTY_ARRAY;
  const statsMap = useTriggerCampaignListStats(rawCampaigns);

  const [deleteTarget, setDeleteTarget] = useState<CampaignWithStats | null>(null);

  const handleDelete = useCallback((campaign: CampaignWithStats) => {
    setDeleteTarget(campaign);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteCampaign.mutate(deleteTarget.id, {
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
  }, [deleteTarget, deleteCampaign, query.data?.data, searchParams.page, setPagination]);

  const columns = useTriggerCampaignsColumns({
    onDelete: handleDelete,
    canDelete,
  });

  const data = useMemo<CampaignWithStats[]>(() => {
    if (!rawCampaigns.length) return EMPTY_ARRAY;
    return rawCampaigns.map((c) => {
      const stats = statsMap.get(c.id);
      return {
        ...c,
        deliveredRate: stats?.deliveredRate ?? '0%',
        openRate: stats?.openRate ?? '0%',
        ctr: stats?.ctr ?? '0%',
        ctor: stats?.ctor ?? '0%',
        unsubscribeCount: stats?.unsubscribeCount ?? 0,
        bounceCount: stats?.bounceCount ?? 0,
      };
    });
  }, [rawCampaigns, statsMap]);
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
        <ListPage.Header title={t('triggerCampaigns.pageTitle')}>
          {canCreate && (
            <Button size="sm" asChild>
              <Link to="/trigger-campaign/create">
                <Plus className="mr-1 h-4 w-4" />
                {t('triggerCampaigns.createCampaign')}
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
              entityName={t('triggerCampaigns.entityNamePlural')}
              hasSearch={searchParams.search.length > 0}
              onClearSearch={() => setSearch('')}
              icon={Zap}
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
        title={t('common.deleteConfirmTitle', { entity: t('triggerCampaigns.entityName') })}
        description={t('common.deleteConfirmMessage', {
          name: deleteTarget?.title ?? '',
        })}
        onConfirm={confirmDelete}
        loading={deleteCampaign.isPending}
      />
    </>
  );
}
