import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import type { CustomField } from './types';

const staticColumns: ColumnDef<CustomField, unknown>[] = [
  {
    accessorKey: 'title',
    header: 'customFields.titleColumn',
    enableSorting: true,
    cell: ({ row }) => (
      <Link
        to="/customfields/$customFieldId"
        params={{ customFieldId: String(row.original.id) }}
        className="text-primary font-medium hover:underline"
      >
        {row.original.title}
      </Link>
    ),
  },
  {
    accessorKey: 'name',
    header: 'customFields.name',
  },
  {
    accessorKey: 'type',
    header: 'customFields.type',
    cell: ({ row }) => (row.original.type ? <Badge variant="secondary">{row.original.type}</Badge> : null),
  },
];

interface UseCustomFieldsColumnsOptions {
  onDelete: (field: CustomField) => void;
  canDelete: boolean;
}

export function useCustomFieldsColumns({
  onDelete,
  canDelete,
}: UseCustomFieldsColumnsOptions): ColumnDef<CustomField, unknown>[] {
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
          const deleteLabel = t('common.deleteEntity', {
            entity: t('customFields.entityName'),
          });

          return (
            <div className="flex justify-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link to="/customfields/$customFieldId" params={{ customFieldId: String(row.original.id) }}>
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
    ] as ColumnDef<CustomField, unknown>[];
  }, [t, onDelete, canDelete]);
}
