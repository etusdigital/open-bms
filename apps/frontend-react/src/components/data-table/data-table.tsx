import {
  type ColumnDef,
  type Table as TanStackTable,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const EMPTY_ARRAY: never[] = [];

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data?: TData[];
  rowCount?: number;
  table?: TanStackTable<TData>;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

/**
 * Generic data table with built-in sortable headers, loading skeleton, and error state.
 *
 * Can be used in two modes:
 * 1. Pass a pre-configured `table` instance (for server-side pagination/sorting)
 * 2. Pass `columns` + `data` for simple client-side tables
 */
export function DataTable<TData>({
  columns,
  data,
  rowCount,
  table: externalTable,
  isLoading = false,
  isFetching = false,
  error,
  onRetry,
}: DataTableProps<TData>) {
  const internalTable = useReactTable({
    columns,
    data: data ?? EMPTY_ARRAY,
    rowCount: rowCount ?? 0,
    getCoreRowModel: getCoreRowModel(),
  });

  const table = externalTable ?? internalTable;
  const { t } = useTranslation();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12">
        <p className="text-muted-foreground text-sm">{t('common.errorLoadingData')}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : ''}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isSticky = (header.column.columnDef.meta as Record<string, unknown>)?.sticky === 'right';
                return (
                  <TableHead key={header.id} className={cn(isSticky && 'bg-background sticky right-0 z-10')}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        className="hover:text-foreground hover:bg-muted -ml-2 flex items-center gap-1 rounded-md px-2 py-1 transition-colors"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="text-muted-foreground/50 h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {table.getAllColumns().map((col) => (
                    <TableCell key={col.id}>
                      <Skeleton className="h-4 w-full max-w-[200px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : table.getRowModel().rows.length > 0
              ? table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      const isSticky = (cell.column.columnDef.meta as Record<string, unknown>)?.sticky === 'right';
                      return (
                        <TableCell key={cell.id} className={cn(isSticky && 'bg-background sticky right-0')}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              : null}
        </TableBody>
      </Table>
    </div>
  );
}
