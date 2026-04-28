import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { WarmupDailyTableRow } from '../types';
import { WARMUP_COLORS } from '../constants';

function ProgressBar({ value, color }: { value: string; color: string }) {
  const pct = Math.min(100, Number(value) || 0);
  return (
    <div className="bg-muted mt-1 h-1 w-full overflow-hidden rounded-full">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function PercentageCell({ percentage, count, color }: { percentage: string; count?: number; color: string }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between tabular-nums">
        <span style={{ color }}>{percentage}%</span>
        {count != null && <span className="text-muted-foreground">{(count ?? 0).toLocaleString()}</span>}
      </div>
      <ProgressBar value={percentage} color={color} />
    </div>
  );
}

const PAGE_SIZE = 20;

interface WarmupStatsTableProps {
  data: WarmupDailyTableRow[];
}

export function WarmupStatsTable({ data }: WarmupStatsTableProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);

  const pageCount = Math.ceil(data.length / PAGE_SIZE);
  const pageData = useMemo(() => data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [data, page]);

  const columns = useMemo<ColumnDef<WarmupDailyTableRow>[]>(
    () => [
      {
        accessorKey: 'formattedDate',
        header: t('warmups.date'),
      },
      {
        accessorKey: 'delivered',
        header: t('warmups.delivered'),
        cell: ({ row }) => <span className="tabular-nums">{(row.original.delivered ?? 0).toLocaleString()}</span>,
      },
      {
        id: 'open',
        header: t('warmups.open'),
        cell: ({ row }) => (
          <PercentageCell
            percentage={row.original.percentageOpen}
            count={row.original.open}
            color={WARMUP_COLORS.open}
          />
        ),
      },
      {
        id: 'click',
        header: t('warmups.click'),
        cell: ({ row }) => (
          <PercentageCell
            percentage={row.original.percentageClick}
            count={row.original.click}
            color={WARMUP_COLORS.click}
          />
        ),
      },
      {
        id: 'ctor',
        header: t('warmups.ctor'),
        cell: ({ row }) => <PercentageCell percentage={row.original.percentageCtor} color={WARMUP_COLORS.estimate} />,
      },
      {
        id: 'unsubscribe',
        header: t('warmups.unsubscribeShort'),
        cell: ({ row }) => (
          <PercentageCell
            percentage={row.original.percentageUnsubscribe}
            count={row.original.unsubscribe}
            color={WARMUP_COLORS.unsubscribe}
          />
        ),
      },
      {
        id: 'uto',
        header: t('warmups.uto'),
        cell: ({ row }) => <PercentageCell percentage={row.original.percentageUto} color={WARMUP_COLORS.unsubscribe} />,
      },
      {
        id: 'bounce',
        header: t('warmups.bounce'),
        cell: ({ row }) => (
          <PercentageCell
            percentage={row.original.percentageBounce}
            count={row.original.bounce}
            color={WARMUP_COLORS.bounce}
          />
        ),
      },
    ],
    [t],
  );

  const table = useReactTable({
    data: pageData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs whitespace-nowrap">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-3 py-2 text-xs">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
