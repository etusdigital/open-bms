import { use, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  flexRender,
  type SortingState,
  type PaginationState,
} from '@tanstack/react-table';
import { Download, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermissions } from '@/hooks/use-permissions';
import { StatisticsContext } from '../../context/statistics-context';
import type { StatisticsTableRow } from '../../types';
import { useEmailColumns } from './use-email-columns';
import { usePushColumns } from './use-push-columns';
import { usePerUserColumns } from './use-per-user-columns';
import { exportStatisticsCsv } from './csv-export';

const EMPTY_DATA: StatisticsTableRow[] = [];

export function StatisticsTable() {
  const ctx = use(StatisticsContext)!;
  const { t } = useTranslation();
  const { can } = usePermissions();

  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });

  const emailColumns = useEmailColumns();
  const pushColumns = usePushColumns(ctx.messageType === 'web-push');
  const perUserColumns = usePerUserColumns();

  const v = ctx.metricVisibility;

  const columns = useMemo(() => {
    const base = ctx.showPerUser ? perUserColumns : ctx.messageType === 'email' ? emailColumns : pushColumns;

    return base.filter((col) => {
      const meta = col.meta as Record<string, unknown> | undefined;
      const metricKey = meta?.metricKey as string | undefined;
      if (!metricKey) return true; // always show columns without a metricKey (e.g. date)
      return v[metricKey] !== false;
    });
  }, [ctx.showPerUser, ctx.messageType, emailColumns, pushColumns, perUserColumns, v]);

  const data = useMemo(() => ctx.tableData ?? EMPTY_DATA, [ctx.tableData]);

  const table = useReactTable({
    columns,
    data,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSortingRemoval: false,
  });

  const handleExport = () => {
    const headers = columns.map((c) => (typeof c.header === 'string' ? c.header : ''));
    const keys = columns.map((c) => ('accessorKey' in c ? c.accessorKey : '')) as (keyof StatisticsTableRow)[];
    const messageType = ctx.messageType;
    exportStatisticsCsv(`statistics-${messageType}`, headers, keys, data);
  };

  if (ctx.isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-muted h-10 w-full animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="py-2">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="cursor-pointer text-xs font-semibold whitespace-nowrap select-none"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div
                        className={`flex items-center gap-1 ${(header.column.columnDef.meta as Record<string, unknown>)?.align === 'right' ? 'justify-end' : ''}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-muted-foreground h-24 text-center">
                    {t('statistics.noData')}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          {can('analytics:dashboard_export') && (
            <Button variant="outline" size="sm" onClick={handleExport} disabled={data.length === 0}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {t('statistics.export')}
            </Button>
          )}
          <span className="text-muted-foreground text-sm tabular-nums">
            {t('statistics.pageOf', {
              current: table.getState().pagination.pageIndex + 1,
              total: Math.max(table.getPageCount(), 1),
            })}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
