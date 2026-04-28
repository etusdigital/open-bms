import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CampaignStatus, CAMPAIGN_STATUS_LABELS } from '@/features/campaigns/types';
import type { CampaignWithStats } from '@/features/campaigns/types';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

interface UseTriggerCampaignsColumnsOptions {
  onDelete: (campaign: CampaignWithStats) => void;
  canDelete: boolean;
}

export function useTriggerCampaignsColumns({
  onDelete,
  canDelete,
}: UseTriggerCampaignsColumnsOptions): ColumnDef<CampaignWithStats, unknown>[] {
  const { t } = useTranslation();

  return useMemo(() => {
    const columns: ColumnDef<CampaignWithStats, unknown>[] = [
      {
        accessorKey: 'title',
        header: t('triggerCampaigns.title'),
        enableSorting: true,
        cell: ({ row }) => (
          <Link
            to="/trigger-campaign/$campaignId"
            params={{ campaignId: String(row.original.id) }}
            className="text-primary font-medium hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: 'status',
        header: t('campaigns.status'),
        enableSorting: true,
        cell: ({ row }) => {
          const status = row.original.status as CampaignStatus;
          const labelKey = CAMPAIGN_STATUS_LABELS[status];
          return <Badge variant={getStatusVariant(status)}>{labelKey ? t(labelKey as never) : String(status)}</Badge>;
        },
      },
      {
        accessorKey: 'messageType',
        header: t('triggerCampaigns.messageType'),
        enableSorting: true,
        cell: ({ row }) => {
          const labels: Record<string, string> = {
            email: 'Email',
            sms: 'SMS',
            'web-push': 'Web Push',
            'mobile-push': 'Mobile Push',
            whatsapp: 'WhatsApp',
          };
          return labels[row.original.messageType] ?? row.original.messageType;
        },
      },
      {
        accessorKey: 'updatedAt',
        header: t('triggerCampaigns.updatedAt'),
        enableSorting: true,
        cell: ({ row }) => formatDate(row.original.updatedAt),
      },
      {
        accessorKey: 'sentContacts',
        header: t('triggerCampaigns.sentContacts'),
        enableSorting: true,
        cell: ({ row }) => row.original.sentContacts?.toLocaleString() ?? '—',
      },
      {
        accessorKey: 'deliveredRate',
        header: t('triggerCampaigns.deliveredRate'),
        enableSorting: false,
        cell: ({ row }) => row.original.deliveredRate ?? '—',
      },
      {
        accessorKey: 'openRate',
        header: t('triggerCampaigns.openRate'),
        enableSorting: false,
        cell: ({ row }) => row.original.openRate ?? '—',
      },
      {
        accessorKey: 'ctr',
        header: t('triggerCampaigns.ctr'),
        enableSorting: false,
        cell: ({ row }) => row.original.ctr ?? '—',
      },
      {
        accessorKey: 'ctor',
        header: t('triggerCampaigns.ctor'),
        enableSorting: false,
        cell: ({ row }) => row.original.ctor ?? '—',
      },
      {
        accessorKey: 'unsubscribeCount',
        header: t('triggerCampaigns.unsubscribe'),
        enableSorting: false,
        cell: ({ row }) => row.original.unsubscribeCount ?? 0,
      },
      {
        accessorKey: 'bounceCount',
        header: t('triggerCampaigns.bounce'),
        enableSorting: false,
        cell: ({ row }) => row.original.bounceCount ?? 0,
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const editLabel = t('common.edit');
          const deleteLabel = t('common.deleteEntity', {
            entity: t('triggerCampaigns.entityName'),
          });

          return (
            <div className="flex justify-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link to="/trigger-campaign/$campaignId" params={{ campaignId: String(row.original.id) }}>
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
    ];

    return columns;
  }, [t, onDelete, canDelete]);
}

function getStatusVariant(status: CampaignStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case CampaignStatus.Draft:
      return 'secondary';
    case CampaignStatus.Scheduled:
      return 'outline';
    case CampaignStatus.Sending:
    case CampaignStatus.SendingTestAb:
    case CampaignStatus.Completed:
      return 'default';
    case CampaignStatus.Paused:
    case CampaignStatus.Stopped:
      return 'destructive';
    default:
      return 'secondary';
  }
}
