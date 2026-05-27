import { useState, useCallback, useMemo, useRef, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Megaphone, Plus, Loader2, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { useListSearchParams } from '@/hooks/use-list-search-params';
import type { CampaignsSearchParams } from './campaigns-search-schema';
import { usePermissions } from '@/hooks/use-permissions';
import {
  useCampaignsList,
  useDeleteCampaign,
  useDuplicateCampaign,
  useCampaignListStats,
  useCampaignStatusCounts,
  useCampaignStatistics,
} from './use-campaigns';
import { CampaignStatus } from './types';
import { useCampaignsColumns } from './campaigns-columns';
import { MessagePreviewDialog } from '@/components/message-preview-dialog';
import { CampaignsFilterBar } from './components/campaigns-filter-bar';
import { DateRangePicker } from '@/components/date-range-picker';
import type { CampaignWithStats } from './types';

const EMPTY_ARRAY: CampaignWithStats[] = [];

interface CampaignsPageProps {
  searchParams: CampaignsSearchParams;
}

export default function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('campaigns:create');
  const canDelete = can('campaigns:delete');
  const canDuplicate = can('campaigns:duplicate');

  const { pagination, sorting, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  // Refetch the list every 15s when campaigns are actively sending/sendingTestAb
  // so status transitions (e.g. SendingTestAb → Sending) are picked up.
  const hasSendingRef = useRef(false);
  const query = useCampaignsList(searchParams, hasSendingRef.current ? 15_000 : false);
  const statusCounts = useCampaignStatusCounts(searchParams);
  const deleteCampaign = useDeleteCampaign();
  const duplicateCampaign = useDuplicateCampaign();
  const rawCampaigns = query.data?.data ?? EMPTY_ARRAY;
  hasSendingRef.current = rawCampaigns.some(
    (c) => c.status === CampaignStatus.Sending || c.status === CampaignStatus.SendingTestAb,
  );

  // Poll progress for campaigns that are sending or sending test A/B.
  // SendingTestAb campaigns don't show a progress bar, but polling lets
  // us detect when they transition to Sending (status 6 → 2).
  const activeSendingIds = useMemo(
    () =>
      rawCampaigns
        .filter((c) => c.status === CampaignStatus.Sending || c.status === CampaignStatus.SendingTestAb)
        .map((c) => c.id),
    [rawCampaigns],
  );
  const { data: sendingStats } = useCampaignStatistics(activeSendingIds, activeSendingIds.length > 0);

  // For in-progress campaigns the DB column `sent_contacts` is only filled
  // at completion (campaign-events-tracker writes it on the final batch).
  // Inject the live Redis-backed counter so deliveredRate = delivered/sent
  // doesn't divide by zero while a campaign is still sending.
  const enrichedCampaigns = useMemo(() => {
    if (!sendingStats?.length) return rawCampaigns;
    const liveSent = new Map<number, number>();
    for (const entry of sendingStats) {
      const n = Number(entry.sentContacts);
      if (Number.isFinite(n) && n > 0) liveSent.set(Number(entry.id), n);
    }
    if (liveSent.size === 0) return rawCampaigns;
    return rawCampaigns.map((c) => {
      const live = liveSent.get(c.id);
      return live !== undefined && (c.sentContacts == null || c.sentContacts < live)
        ? { ...c, sentContacts: live }
        : c;
    });
  }, [rawCampaigns, sendingStats]);

  const statsMap = useCampaignListStats(enrichedCampaigns);

  const sendingProgressMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!sendingStats) return map;
    for (const entry of sendingStats) {
      const pct = Number(entry.sentPercentage) || 0;
      map.set(Number(entry.id), pct);
    }
    return map;
  }, [sendingStats]);

  // IDs that reached 100% — mark as completed and exclude from future polls
  const completedByPolling = useMemo(() => {
    const set = new Set<number>();
    for (const [id, pct] of sendingProgressMap) {
      if (pct >= 100) set.add(id);
    }
    return set;
  }, [sendingProgressMap]);

  const [deleteTarget, setDeleteTarget] = useState<CampaignWithStats | null>(null);
  const [previewTarget, setPreviewTarget] = useState<CampaignWithStats | null>(null);

  const handleDelete = useCallback((campaign: CampaignWithStats) => {
    setDeleteTarget(campaign);
  }, []);

  const handlePreviewMessage = useCallback((campaign: CampaignWithStats) => {
    setPreviewTarget(campaign);
  }, []);

  const handleDateRangeChange = useCallback(
    (from: string, to: string) => {
      startTransition(() => {
        void navigate({
          to: '.',
          search: (prev: Record<string, unknown>) => ({
            ...prev,
            startDate: from,
            endDate: to,
            page: 1,
          }),
        } as never);
      });
    },
    [navigate],
  );

  const handleDuplicate = useCallback(
    (campaign: CampaignWithStats) => {
      duplicateCampaign.mutate(campaign.id);
    },
    [duplicateCampaign],
  );

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

  const columns = useCampaignsColumns({
    onDelete: handleDelete,
    onDuplicate: handleDuplicate,
    onPreviewMessage: handlePreviewMessage,
    canDelete,
    canDuplicate,
  });

  const data = useMemo<CampaignWithStats[]>(() => {
    if (!enrichedCampaigns.length) return EMPTY_ARRAY;
    return enrichedCampaigns.map((c) => {
      const stats = statsMap.get(c.id);
      const isDoneByPolling = completedByPolling.has(c.id);
      return {
        ...c,
        ...(isDoneByPolling && { status: CampaignStatus.Completed }),
        deliveredRate: stats?.deliveredRate ?? '0%',
        openRate: stats?.openRate ?? '0%',
        ctr: stats?.ctr ?? '0%',
        ctor: stats?.ctor ?? '0%',
        unsubscribeCount: stats?.unsubscribeCount ?? 0,
        bounceCount: stats?.bounceCount ?? 0,
        sendingProgress: isDoneByPolling
          ? undefined
          : (sendingProgressMap.get(c.id) ??
            (c.status === CampaignStatus.Sending ? Number(c.sentPercentage) || 0 : undefined)),
      };
    });
  }, [enrichedCampaigns, statsMap, sendingProgressMap, completedByPolling]);
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
        <ListPage.Header title={t('campaigns.pageTitle')}>
          {canCreate && (
            <Button size="sm" asChild>
              <Link to="/campaigns/create">
                <Plus className="mr-1 h-4 w-4" />
                {t('campaigns.createCampaign')}
              </Link>
            </Button>
          )}
        </ListPage.Header>

        <ListPage.Toolbar>
          <DataTableSearch value={searchParams.search} onChange={setSearch} />
          <DateRangePicker
            from={searchParams.startDate}
            to={searchParams.endDate}
            onChange={handleDateRangeChange}
            clearable
          />
          <div className="ml-auto">
            <CampaignsFilterBar searchParams={searchParams} />
          </div>
        </ListPage.Toolbar>

        {/* Dashboard Cards */}
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                <Loader2 className="h-3.5 w-3.5" />
                {t('campaigns.statsSending')}
              </div>
              <p className="text-2xl font-bold">{statusCounts.data?.sending?.toLocaleString() ?? '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                <Clock className="h-3.5 w-3.5" />
                {t('campaigns.statsScheduled')}
              </div>
              <p className="text-2xl font-bold">{statusCounts.data?.scheduled?.toLocaleString() ?? '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('campaigns.statsCompleted')}
              </div>
              <p className="text-2xl font-bold">{statusCounts.data?.completed?.toLocaleString() ?? '—'}</p>
            </CardContent>
          </Card>
        </div>

        {isEmpty ? (
          <ListPage.Empty>
            <DataTableEmptyState
              entityName={t('campaigns.entityNamePlural')}
              hasSearch={searchParams.search.length > 0}
              onClearSearch={() => setSearch('')}
              icon={Megaphone}
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
        title={t('common.deleteConfirmTitle', { entity: t('campaigns.entityName') })}
        description={t('common.deleteConfirmMessage', {
          name: deleteTarget?.title ?? '',
        })}
        onConfirm={confirmDelete}
        loading={deleteCampaign.isPending}
      />

      {previewTarget &&
        (() => {
          const rawMsgs = previewTarget.campaignMessage ?? [];
          const ids = rawMsgs.map((m: any) => m.message?.id ?? m.messageId ?? m.id).filter((id: number) => id > 0);
          const labels =
            ids.length > 1 ? ids.map((_: number, i: number) => `Message ${String.fromCharCode(65 + i)}`) : undefined;
          return ids.length > 0 ? (
            <MessagePreviewDialog
              messageIds={ids}
              showTabs={ids.length > 1}
              tabLabels={labels}
              filterId={previewTarget.id}
              filterType="campaign"
              open
              onOpenChange={(open) => {
                if (!open) setPreviewTarget(null);
              }}
            />
          ) : null;
        })()}
    </>
  );
}
