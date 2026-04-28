import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DescriptionCell } from '@/components/data-table/description-cell';
import type { Pool } from './types';

function formatSender(pool: Pool): string {
  if (pool.senderName && pool.senderEmail) {
    return `${pool.senderName} - ${pool.senderEmail}`;
  }
  return pool.senderEmail || pool.senderName || '—';
}

const staticColumns: ColumnDef<Pool, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'pools.name',
    enableSorting: true,
    cell: ({ row }) => (
      <div className="max-w-[300px]">
        <Link
          to="/pools/$poolId"
          params={{ poolId: String(row.original.id) }}
          className="text-primary font-medium hover:underline"
        >
          {row.original.name}
        </Link>
        <DescriptionCell description={row.original.description} />
      </div>
    ),
  },
  {
    accessorKey: 'senderCompost',
    id: 'sender',
    header: 'pools.sender',
    enableSorting: false,
    cell: ({ row }) => <span className="text-sm">{formatSender(row.original)}</span>,
  },
  {
    accessorKey: 'poolName',
    header: 'pools.poolName',
    enableSorting: true,
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.poolName}</span>,
  },
  {
    accessorKey: 'isDefault',
    header: 'pools.isDefault',
    enableSorting: false,
    cell: ({ row }) => (row.original.isDefault ? <Badge variant="secondary">Default</Badge> : null),
  },
];

interface UsePoolsColumnsOptions {
  onDelete: (pool: Pool) => void;
  canDelete: boolean;
}

export function usePoolsColumns({ onDelete, canDelete }: UsePoolsColumnsOptions): ColumnDef<Pool, unknown>[] {
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
          const deleteLabel = t('common.deleteEntity', { entity: t('pools.entityName') });

          return (
            <div className="flex justify-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link to="/pools/$poolId" params={{ poolId: String(row.original.id) }}>
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
    ] as ColumnDef<Pool, unknown>[];
  }, [t, onDelete, canDelete]);
}
