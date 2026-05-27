import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Template } from './types';
import { formatDateTime } from '@/lib/datetime';

const staticColumns: ColumnDef<Template, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'templates.name',
    enableSorting: true,
    cell: ({ row }) => (
      <Link
        to="/templates/$templateId"
        params={{ templateId: String(row.original.id) }}
        className="text-primary font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'updatedAt',
    header: 'templates.updatedAt',
    enableSorting: true,
    cell: ({ row }) => formatDateTime(row.original.updatedAt),
  },
];

interface UseTemplatesColumnsOptions {
  onDelete: (template: Template) => void;
  onDuplicate: (template: Template) => void;
  canDelete: boolean;
}

export function useTemplatesColumns({
  onDelete,
  onDuplicate,
  canDelete,
}: UseTemplatesColumnsOptions): ColumnDef<Template, unknown>[] {
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
          const duplicateLabel = t('templates.duplicate');
          const deleteLabel = t('common.deleteEntity', {
            entity: t('templates.entityName'),
          });

          return (
            <div className="flex justify-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link to="/templates/$templateId" params={{ templateId: String(row.original.id) }}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">{editLabel}</span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{editLabel}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" onClick={() => onDuplicate(row.original)}>
                      <Copy className="h-3.5 w-3.5" />
                      <span className="sr-only">{duplicateLabel}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{duplicateLabel}</TooltipContent>
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
    ] as ColumnDef<Template, unknown>[];
  }, [t, onDelete, onDuplicate, canDelete]);
}
