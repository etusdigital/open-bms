import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Sender } from './types';

const staticColumns: ColumnDef<Sender, unknown>[] = [
  {
    accessorKey: 'senderName',
    header: 'senders.senderName',
    enableSorting: true,
    cell: ({ row }) => (
      <div className="max-w-[300px]">
        <Link
          to="/senders/$senderId"
          params={{ senderId: String(row.original.id) }}
          className="text-primary font-medium hover:underline"
        >
          {row.original.senderName}
        </Link>
      </div>
    ),
  },
  {
    accessorKey: 'senderEmail',
    header: 'senders.senderEmail',
    enableSorting: true,
    cell: ({ row }) => <span className="text-sm">{row.original.senderEmail}</span>,
  },
  {
    accessorKey: 'senderReplyTo',
    header: 'senders.senderReplyTo',
    enableSorting: false,
    cell: ({ row }) => <span className="text-sm">{row.original.senderReplyTo || '—'}</span>,
  },
  {
    accessorKey: 'isDefault',
    header: 'senders.isDefault',
    enableSorting: false,
    cell: ({ row }) => (row.original.isDefault ? <Badge variant="secondary">Default</Badge> : null),
  },
];

interface UseSendersColumnsOptions {
  onDelete: (sender: Sender) => void;
  canDelete: boolean;
}

export function useSendersColumns({ onDelete, canDelete }: UseSendersColumnsOptions): ColumnDef<Sender, unknown>[] {
  const { t } = useTranslation();

  return useMemo(() => {
    const translated = staticColumns.map((col) => ({
      ...col,
      header: typeof col.header === 'string' ? t(col.header as never) : col.header,
    }));

    return [
      ...translated,
      {
        id: 'status',
        header: '',
        cell: ({ row }) =>
          row.original.removedAtSource ? (
            <Badge variant="outline" className="text-muted-foreground">
              {t('senders.removedAtSource')}
            </Badge>
          ) : null,
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const editLabel = t('common.edit');
          const deleteLabel = t('common.deleteEntity', { entity: t('senders.entityName') });

          return (
            <div className="flex justify-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link to="/senders/$senderId" params={{ senderId: String(row.original.id) }}>
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
    ] as ColumnDef<Sender, unknown>[];
  }, [t, onDelete, canDelete]);
}
