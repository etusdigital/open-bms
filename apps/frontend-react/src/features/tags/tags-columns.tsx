import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import type { Tag } from './types';

const staticColumns: ColumnDef<Tag, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'tags.name',
    enableSorting: true,
    cell: ({ row }) => (
      <Link
        to="/tags/$tagId"
        params={{ tagId: String(row.original.id) }}
        className="text-primary font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'type',
    header: 'tags.type',
    cell: ({ row }) => (row.original.type ? <Badge variant="secondary">{row.original.type}</Badge> : null),
  },
  {
    accessorKey: 'countContacts',
    header: 'tags.contactCount',
    cell: ({ row }) => row.original.countContacts?.toLocaleString() ?? '—',
  },
];

interface UseTagsColumnsOptions {
  onDelete: (tag: Tag) => void;
  canDelete: boolean;
}

export function useTagsColumns({ onDelete, canDelete }: UseTagsColumnsOptions): ColumnDef<Tag, unknown>[] {
  const { t } = useTranslation();

  return useMemo(() => {
    // Translate static column headers
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
          const deleteLabel = t('common.deleteEntity', {
            entity: t('tags.entityName'),
          });

          return (
            <div className="flex justify-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link to="/tags/$tagId" params={{ tagId: String(row.original.id) }}>
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
    ] as ColumnDef<Tag, unknown>[];
  }, [t, onDelete, canDelete]);
}
