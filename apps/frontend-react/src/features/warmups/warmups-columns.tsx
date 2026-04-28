import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DescriptionCell } from '@/components/data-table/description-cell';
import type { Warmup, WarmupStatus } from './types';
import { WARMUP_STATUS_LABELS } from './types';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

const STATUS_COLORS: Record<WarmupStatus, { color: string; bg: string }> = {
  notStarted: { color: '#A6A6A6', bg: '#F5F5F5' },
  running: { color: '#7B61FF', bg: '#F2EFFF' },
  transferring: { color: '#7B61FF', bg: '#F2EFFF' },
  finished: { color: '#0FB75C', bg: '#F2FFF8' },
  deactivated: { color: '#A6A6A6', bg: '#F5F5F5' },
};

function getProgress(warmup: Warmup): number {
  if (!warmup.target || warmup.target === 0) return 0;
  return Math.min(100, Math.round(((warmup.currentSend ?? 0) / warmup.target) * 100));
}

function getDaysPast(createdAt?: string): number {
  if (!createdAt) return 0;
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.round(diff / (24 * 60 * 60 * 1000));
}

function WarmupDayTooltip({ createdAt }: { createdAt?: string }) {
  const { t } = useTranslation();
  return <>{t('warmups.warmupDay', { day: getDaysPast(createdAt) })}</>;
}

function StatusBadge({ status }: { status: WarmupStatus }) {
  const { t } = useTranslation();
  const colors = STATUS_COLORS[status];
  return (
    <Badge variant="outline" style={{ color: colors.color, backgroundColor: colors.bg, borderColor: 'transparent' }}>
      {t(WARMUP_STATUS_LABELS[status] as never)}
    </Badge>
  );
}

const staticColumns: ColumnDef<Warmup, unknown>[] = [
  {
    accessorKey: 'sender',
    header: 'warmups.sender',
    enableSorting: true,
    cell: ({ row }) => (
      <div className="max-w-[300px]">
        <Link
          to="/warmups/$warmupId"
          params={{ warmupId: String(row.original.id) }}
          className="text-primary font-medium hover:underline"
        >
          {row.original.sender}
        </Link>
        <DescriptionCell description={row.original.description} />
      </div>
    ),
  },
  {
    id: 'accountName',
    header: 'warmups.account',
    cell: ({ row }) => row.original.account?.name ?? '—',
  },
  {
    id: 'targetAccountName',
    header: 'warmups.executionAccount',
    cell: ({ row }) => row.original.targetAccount?.name ?? '—',
  },
  {
    accessorKey: 'status',
    header: 'warmups.status',
    enableSorting: true,
    cell: ({ row }) => {
      const status = row.original.status;
      return status ? <StatusBadge status={status} /> : '—';
    },
  },
  {
    id: 'progress',
    header: 'warmups.progress',
    enableSorting: false,
    cell: ({ row }) => {
      const pct = getProgress(row.original);
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex min-w-[120px] items-center gap-2">
              <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-muted-foreground w-10 text-right text-xs">{pct}%</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <WarmupDayTooltip createdAt={row.original.createdAt} />
          </TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'warmups.createdAt',
    enableSorting: true,
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
];

interface UseWarmupsColumnsOptions {
  onDelete: (warmup: Warmup) => void;
  canDelete: boolean;
}

export function useWarmupsColumns({ onDelete, canDelete }: UseWarmupsColumnsOptions): ColumnDef<Warmup, unknown>[] {
  const { t } = useTranslation();

  return useMemo(() => {
    const translated = staticColumns.map((col) => ({
      ...col,
      header: typeof col.header === 'string' ? t(col.header as never) : col.header,
    }));

    return [
      ...translated,
      {
        id: 'actions',
        cell: ({ row }) => {
          const editLabel = t('common.edit');
          const deleteLabel = t('common.deleteEntity', { entity: t('warmups.entityName') });

          return (
            <div className="flex justify-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link to="/warmups/$warmupId/edit" params={{ warmupId: String(row.original.id) }}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">{editLabel}</span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{editLabel}</TooltipContent>
                </Tooltip>

                {canDelete && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(row.original)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">{deleteLabel}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{deleteLabel}</TooltipContent>
                  </Tooltip>
                )}
              </TooltipProvider>
            </div>
          );
        },
      },
    ] as ColumnDef<Warmup, unknown>[];
  }, [t, onDelete, canDelete]);
}
