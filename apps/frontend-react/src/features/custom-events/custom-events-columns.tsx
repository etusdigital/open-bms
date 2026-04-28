import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DescriptionCell } from '@/components/data-table/description-cell';
import type { CustomEvent } from './types';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

const staticColumns: ColumnDef<CustomEvent, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'customEvents.name',
    enableSorting: true,
    cell: ({ row }) => (
      <div className="max-w-[300px]">
        <Link
          to="/custom-events/$customEventId"
          params={{ customEventId: String(row.original.id) }}
          className="text-primary font-medium hover:underline"
        >
          {row.original.name}
        </Link>
        <DescriptionCell description={row.original.description} />
      </div>
    ),
  },
  {
    accessorKey: 'updatedAt',
    header: 'customEvents.updatedAt',
    enableSorting: true,
    cell: ({ row }) => formatDate(row.original.updatedAt),
  },
];

interface UseCustomEventsColumnsOptions {
  onDelete: (event: CustomEvent) => void;
  canDelete: boolean;
}

export function useCustomEventsColumns({
  onDelete,
  canDelete,
}: UseCustomEventsColumnsOptions): ColumnDef<CustomEvent, unknown>[] {
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
          const deleteLabel = row.original.isDefault
            ? t('customEvents.cannotDeleteDefault')
            : t('common.deleteEntity', { entity: t('customEvents.entityName') });

          return (
            <div className="flex justify-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link to="/custom-events/$customEventId" params={{ customEventId: String(row.original.id) }}>
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
                        disabled={row.original.isDefault}
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
    ] as ColumnDef<CustomEvent, unknown>[];
  }, [t, onDelete, canDelete]);
}
