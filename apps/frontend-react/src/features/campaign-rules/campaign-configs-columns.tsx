import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2, Copy, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CampaignConfig } from './types';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

const staticColumns: ColumnDef<CampaignConfig, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'campaignRules.configName',
    enableSorting: true,
    cell: ({ row }) => (
      <Link
        to="/campaign-rules/configs/$configId"
        params={{ configId: String(row.original.id) }}
        className="text-primary font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'updatedAt',
    header: 'campaignRules.updatedAt',
    enableSorting: true,
    cell: ({ row }) => formatDate(row.original.updatedAt),
  },
];

interface UseCampaignConfigsColumnsOptions {
  onDelete: (config: CampaignConfig) => void;
  onDuplicate: (config: CampaignConfig) => void;
  canManage: boolean;
}

export function useCampaignConfigsColumns({
  onDelete,
  onDuplicate,
  canManage,
}: UseCampaignConfigsColumnsOptions): ColumnDef<CampaignConfig, unknown>[] {
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
          const createCampaignLabel = t('campaigns.createFromRule');
          const editLabel = t('common.edit');
          const duplicateLabel = t('campaignRules.duplicate');
          const deleteLabel = t('common.deleteEntity', {
            entity: t('campaignRules.configEntityName'),
          });

          return (
            <div className="flex justify-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link to="/campaigns/from-config/$configId" params={{ configId: String(row.original.id) }}>
                        <PlayCircle className="h-3.5 w-3.5" />
                        <span className="sr-only">{createCampaignLabel}</span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{createCampaignLabel}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link to="/campaign-rules/configs/$configId" params={{ configId: String(row.original.id) }}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">{editLabel}</span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{editLabel}</TooltipContent>
                </Tooltip>

                {canManage && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-xs" onClick={() => onDuplicate(row.original)}>
                          <Copy className="h-3.5 w-3.5" />
                          <span className="sr-only">{duplicateLabel}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{duplicateLabel}</TooltipContent>
                    </Tooltip>

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
                  </>
                )}
              </TooltipProvider>
            </div>
          );
        },
      },
    ] as ColumnDef<CampaignConfig, unknown>[];
  }, [t, onDelete, onDuplicate, canManage]);
}
