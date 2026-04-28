import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2, Copy, Play, Info, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DescriptionCell } from '@/components/data-table/description-cell';
import type { Segment, SegmentStatus } from './types';
import type { ColumnVisibility } from './use-column-visibility';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

function formatCount(count?: number): string {
  if (count === undefined || count === null) return '—';
  return count.toLocaleString();
}

function formatPercentage(count?: number, total?: number): string {
  if (!count || !total || total === 0) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

function getStatusVariant(status?: SegmentStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'reactivating':
      return 'secondary';
    case 'inactive':
      return 'outline';
    default:
      return 'outline';
  }
}

/** Cell that shows count + percentage below */
function ChannelCountCell({ count, total }: { count?: number; total?: number }) {
  return (
    <div className="text-right">
      <div>{formatCount(count)}</div>
      <div className="text-muted-foreground text-xs">{formatPercentage(count, total)}</div>
    </div>
  );
}

interface UseSegmentsColumnsOptions {
  onDelete: (segment: Segment) => void;
  onCopy: (segment: Segment) => void;
  onRun: (segment: Segment) => void;
  canDelete: boolean;
  canExecute: boolean;
  columnVisibility: ColumnVisibility;
  processingIds: Set<number>;
}

export function useSegmentsColumns({
  onDelete,
  onCopy,
  onRun,
  canDelete,
  canExecute,
  columnVisibility,
  processingIds,
}: UseSegmentsColumnsOptions): ColumnDef<Segment, unknown>[] {
  const { t } = useTranslation();

  return useMemo(() => {
    const columns: ColumnDef<Segment, unknown>[] = [
      {
        accessorKey: 'name',
        header: t('segments.name'),
        enableSorting: true,
        cell: ({ row }) => (
          <div className="max-w-[300px]">
            <Link
              to="/segments/$segmentId"
              params={{ segmentId: String(row.original.id) }}
              className="text-primary font-medium hover:underline"
            >
              {row.original.name}
            </Link>
            <DescriptionCell description={row.original.description} />
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('segments.status'),
        enableSorting: true,
        cell: ({ row }) => {
          const status = row.original.status;
          return status ? <Badge variant={getStatusVariant(status)}>{status}</Badge> : '—';
        },
      },
      {
        accessorKey: 'updatedAt',
        header: t('segments.columns.lastEdition'),
        enableSorting: true,
        cell: ({ row }) => formatDate(row.original.updatedAt),
      },
      {
        accessorKey: 'lastRunDate',
        header: t('segments.lastRunDate'),
        enableSorting: true,
        cell: ({ row }) => formatDate(row.original.lastRunDate),
      },
      {
        accessorKey: 'lastCount',
        header: () => (
          <div className="flex items-center justify-end gap-1">
            {t('segments.columns.total')}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="text-primary h-3.5 w-3.5 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[320px] text-xs leading-relaxed">
                  <p className="mb-2">
                    <strong>{t('segments.columns.totalTooltipTitle')}:</strong> {t('segments.columns.totalTooltipDesc')}
                  </p>
                  <p className="mb-2">
                    <strong>{t('segments.columns.emailTooltipTitle')}:</strong> {t('segments.columns.emailTooltipDesc')}
                  </p>
                  <p>
                    <strong>{t('segments.columns.channelsTooltipTitle')}:</strong>{' '}
                    {t('segments.columns.channelsTooltipDesc')}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ),
        enableSorting: true,
        cell: ({ row }) => <div className="text-right font-medium">{formatCount(row.original.lastCount)}</div>,
      },
      // Channel count columns — conditionally included based on visibility settings
      ...(columnVisibility.lastCountEmail
        ? [
            {
              accessorKey: 'lastCountEmail' as const,
              header: () => <div className="text-right">{t('segments.columns.email')}</div>,
              cell: ({ row }: { row: { original: Segment } }) => (
                <ChannelCountCell count={row.original.lastCountEmail} total={row.original.lastCount} />
              ),
            },
          ]
        : []),
      ...(columnVisibility.lastCountWebPush
        ? [
            {
              accessorKey: 'lastCountWebPush' as const,
              header: () => <div className="text-right">{t('segments.columns.webPush')}</div>,
              cell: ({ row }: { row: { original: Segment } }) => (
                <ChannelCountCell count={row.original.lastCountWebPush} total={row.original.lastCount} />
              ),
            },
          ]
        : []),
      ...(columnVisibility.lastCountMobilePush
        ? [
            {
              accessorKey: 'lastCountMobilePush' as const,
              header: () => <div className="text-right">{t('segments.columns.mobilePush')}</div>,
              cell: ({ row }: { row: { original: Segment } }) => (
                <ChannelCountCell count={row.original.lastCountMobilePush} total={row.original.lastCount} />
              ),
            },
          ]
        : []),
      ...(columnVisibility.lastCountPhone
        ? [
            {
              accessorKey: 'lastCountPhone' as const,
              header: () => <div className="text-right">{t('segments.columns.sms')}</div>,
              cell: ({ row }: { row: { original: Segment } }) => (
                <ChannelCountCell count={row.original.lastCountPhone} total={row.original.lastCount} />
              ),
            },
          ]
        : []),
      ...(columnVisibility.lastCountWhatsapp
        ? [
            {
              accessorKey: 'lastCountWhatsapp' as const,
              header: () => <div className="text-right">{t('segments.columns.whatsapp')}</div>,
              cell: ({ row }: { row: { original: Segment } }) => (
                <ChannelCountCell count={row.original.lastCountWhatsapp} total={row.original.lastCount} />
              ),
            },
          ]
        : []),
      {
        id: 'actions',
        cell: ({ row }) => {
          const editLabel = t('common.edit');
          const deleteLabel = t('common.deleteEntity', { entity: t('segments.entityName') });
          const copyLabel = t('segments.copy');
          const runLabel = t('segments.run');
          const isRunning = processingIds.has(row.original.id);

          return (
            <div className="flex justify-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" asChild disabled={isRunning}>
                      <Link
                        to="/segments/$segmentId"
                        params={{ segmentId: String(row.original.id) }}
                        disabled={isRunning}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">{editLabel}</span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{editLabel}</TooltipContent>
                </Tooltip>

                {canExecute && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => onCopy(row.original)}
                          disabled={isRunning}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="sr-only">{copyLabel}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{copyLabel}</TooltipContent>
                    </Tooltip>

                    {isRunning ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon-xs" disabled>
                            <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('segments.statusProcessing')}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon-xs" onClick={() => onRun(row.original)}>
                            <Play className="h-3.5 w-3.5" />
                            <span className="sr-only">{runLabel}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{runLabel}</TooltipContent>
                      </Tooltip>
                    )}
                  </>
                )}

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
    ];

    return columns;
  }, [t, onDelete, onCopy, onRun, canDelete, canExecute, columnVisibility, processingIds]);
}
