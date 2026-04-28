import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { Download, Users } from 'lucide-react';
import { getCoreRowModel, useReactTable, type ColumnDef, type PaginationState } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ListPage } from '@/components/list-page';
import { usePermissions } from '@/hooks/use-permissions';
import { DateRangePicker } from '@/components/date-range-picker';
import { GroupingSelect } from './components/grouping-select';
import { MoreFilters } from './components/more-filters';
import { useLeads } from './use-leads';
import { GROUP_BY_MAP, METRIC_COLUMNS, type GroupByValue, type LeadRow, type LeadsFilters } from './types';
import type { LeadsSearchParams } from './leads-search-schema';

const EMPTY_ARRAY: LeadRow[] = [];

interface LeadsPageProps {
  searchParams: LeadsSearchParams;
}

function toDateStr(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export default function LeadsPage({ searchParams }: LeadsPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermissions();

  // Derive state from URL params
  const groupItems = useMemo<GroupByValue[]>(
    () => (searchParams.groupItems ? (searchParams.groupItems.split(',') as GroupByValue[]) : []),
    [searchParams.groupItems],
  );

  const startDate = searchParams.startDate || toDateStr(new Date());
  const endDate = searchParams.endDate || toDateStr(new Date());

  const filters = useMemo<LeadsFilters>(() => {
    const result: LeadsFilters = {
      email_provider: [],
      utm_source: [],
      utm_campaign: '',
      source_url: '',
    };
    if (!searchParams.search) return result;

    const items = searchParams.search.split(',');
    for (const item of items) {
      const colonIdx = item.indexOf(':');
      if (colonIdx === -1) continue;
      const key = item.slice(0, colonIdx);
      const value = item.slice(colonIdx + 1);
      switch (key) {
        case 'email_provider':
          result.email_provider.push(value);
          break;
        case 'utm_source':
          result.utm_source.push(value);
          break;
        case 'utm_campaign':
          result.utm_campaign = value;
          break;
        case 'source_url':
          result.source_url = value;
          break;
      }
    }
    return result;
  }, [searchParams.search]);

  // Build search string from filters
  const searchItems = useMemo(() => {
    const items: string[] = [];
    for (const v of filters.email_provider) items.push(`email_provider:${v}`);
    for (const v of filters.utm_source) items.push(`utm_source:${v}`);
    if (filters.utm_campaign) items.push(`utm_campaign:${filters.utm_campaign}`);
    if (filters.source_url) items.push(`source_url:${filters.source_url}`);
    return items;
  }, [filters]);

  const query = useLeads({
    groupItems: groupItems,
    startDate,
    endDate,
    search: searchItems,
  });

  const allData = query.data ?? EMPTY_ARRAY;

  // Client-side pagination (backend returns all rows)
  const page = searchParams.page;
  const pageSize = searchParams.pageSize;
  const totalRows = allData.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const paginatedData = useMemo(() => allData.slice((page - 1) * pageSize, page * pageSize), [allData, page, pageSize]);

  const pagination: PaginationState = { pageIndex: page - 1, pageSize };

  // Dynamic columns based on selected group items
  const columns = useMemo<ColumnDef<LeadRow, unknown>[]>(() => {
    const groupCols: ColumnDef<LeadRow, unknown>[] = groupItems.map((value) => ({
      accessorKey: value,
      header: t((GROUP_BY_MAP.get(value)?.labelKey ?? value) as never),
    }));

    const metricCols: ColumnDef<LeadRow, unknown>[] = METRIC_COLUMNS.map((key) => ({
      accessorKey: key,
      header: t(`leads.column.${key}` as never),
      cell: ({ row }) => {
        const val = row.original[key];
        return <span className="tabular-nums">{val != null ? String(val) : ''}</span>;
      },
      meta: { className: 'text-right' },
    }));

    return [...groupCols, ...metricCols];
  }, [groupItems, t]);

  const table = useReactTable({
    columns,
    data: paginatedData,
    rowCount: totalRows,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    state: { pagination },
  });

  // Navigation helpers
  const updateSearch = useCallback(
    (updates: Partial<LeadsSearchParams>) => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          ...updates,
        }),
      } as never);
    },
    [navigate],
  );

  const handleGroupChange = (items: GroupByValue[]) => {
    updateSearch({ groupItems: items.length > 0 ? items.join(',') : '', page: 1 });
  };

  const handleDateChange = (from: string, to: string) => {
    updateSearch({ startDate: from, endDate: to, page: 1 });
  };

  const handleFiltersChange = (newFilters: LeadsFilters) => {
    const items: string[] = [];
    for (const v of newFilters.email_provider) items.push(`email_provider:${v}`);
    for (const v of newFilters.utm_source) items.push(`utm_source:${v}`);
    if (newFilters.utm_campaign) items.push(`utm_campaign:${newFilters.utm_campaign}`);
    if (newFilters.source_url) items.push(`source_url:${newFilters.source_url}`);
    updateSearch({ search: items.join(',') || '', page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    updateSearch({ page: newPage });
  };

  const handlePageSizeChange = (newSize: number) => {
    updateSearch({ page: 1, pageSize: newSize });
  };

  const handleExport = () => {
    if (allData.length === 0) {
      toast.error(t('leads.noDataToExport'));
      return;
    }

    const headerKeys = [...groupItems, ...METRIC_COLUMNS];
    const headerLabels = headerKeys.map((key) => {
      const groupItem = GROUP_BY_MAP.get(key as never);
      return groupItem ? t(groupItem.labelKey as never) : t(`leads.column.${key}` as never);
    });

    const escapeCell = (value: string) => (/[,"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

    const rows = allData.map((item) =>
      headerKeys
        .map((key) => {
          const val = item[key];
          return val != null ? escapeCell(String(val)) : '';
        })
        .join(','),
    );

    const csv = [headerLabels.map(escapeCell).join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leads_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(t('leads.exportSuccess'));
  };

  const isEmpty = !query.isLoading && groupItems.length > 0 && allData.length === 0;
  const noGroupSelected = groupItems.length === 0;

  return (
    <ListPage.Root>
      <ListPage.Header title={t('leads.pageTitle')} />

      <ListPage.Toolbar>
        <div className="flex flex-wrap items-start gap-2">
          <GroupingSelect selected={groupItems} onChange={handleGroupChange} />
          <DateRangePicker from={startDate} to={endDate} onChange={handleDateChange} />
          <MoreFilters filters={filters} onChange={handleFiltersChange} />
        </div>
      </ListPage.Toolbar>

      {noGroupSelected ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center py-24">
          <Users className="mb-4 h-12 w-12 opacity-40" />
          <p className="text-base">{t('leads.selectGroupItemsPrompt')}</p>
        </div>
      ) : isEmpty ? (
        <ListPage.Empty>
          <DataTableEmptyState
            entityName={t('leads.entityNamePlural')}
            hasSearch={searchItems.length > 0}
            onClearSearch={() =>
              handleFiltersChange({
                email_provider: [],
                utm_source: [],
                utm_campaign: '',
                source_url: '',
              })
            }
            icon={Users}
          />
        </ListPage.Empty>
      ) : (
        <>
          {can('analytics:dashboard_export') && groupItems.length > 0 && (
            <div className="flex justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleExport}
                    disabled={query.isLoading || allData.length === 0}
                  >
                    <Download className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('leads.exportData')}</TooltipContent>
              </Tooltip>
            </div>
          )}

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
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalRows={totalRows}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </ListPage.Pagination>
        </>
      )}
    </ListPage.Root>
  );
}
