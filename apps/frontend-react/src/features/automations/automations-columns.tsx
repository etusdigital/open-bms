import { useMemo } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDateTime } from '@/lib/datetime';
import type { Automation } from './types';

interface UseAutomationsColumnsOptions {
  onDelete: (automation: Automation) => void;
  onDuplicate: (automation: Automation) => void;
  canDelete: boolean;
  canCreate: boolean;
}

export function useAutomationsColumns({
  onDelete,
  onDuplicate,
  canDelete,
  canCreate,
}: UseAutomationsColumnsOptions): ColumnDef<Automation, unknown>[] {
  const { t } = useTranslation();

  return useMemo(() => {
    const columns: ColumnDef<Automation, unknown>[] = [
      {
        accessorKey: 'title',
        header: t('automations.title'),
        enableSorting: true,
        cell: ({ row }) => (
          <div>
            <Link
              to="/automations/$automationId"
              params={{ automationId: String(row.original.id) }}
              className="text-foreground font-medium hover:underline"
            >
              {row.original.title}
            </Link>
            {row.original.description && (
              <p className="text-muted-foreground mt-0.5 text-xs">{row.original.description}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'isActive',
        header: t('automations.status'),
        enableSorting: true,
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? t('automations.active') : t('automations.inactive')}
          </Badge>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: t('automations.updatedAt'),
        enableSorting: true,
        cell: ({ row }) => formatDateTime(row.original.updatedAt ?? row.original.createdAt),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const duplicateLabel = t('automations.duplicate');
          const deleteLabel = t('common.deleteEntity', {
            entity: t('automations.entityName'),
          });

          return (
            <div className="flex justify-end gap-1">
              {canCreate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" onClick={() => onDuplicate(row.original)}>
                      <Copy className="h-3.5 w-3.5" />
                      <span className="sr-only">{duplicateLabel}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{duplicateLabel}</TooltipContent>
                </Tooltip>
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
            </div>
          );
        },
      },
    ];

    return columns;
  }, [t, onDelete, onDuplicate, canDelete, canCreate]);
}
