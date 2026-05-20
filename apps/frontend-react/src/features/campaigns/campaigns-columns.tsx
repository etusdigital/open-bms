import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Trash2,
  Copy,
  Send,
  FlaskConical,
  GitBranch,
  RefreshCw,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Phone,
  MoreVertical,
  Eye,
  BarChart3,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CampaignStatus, CAMPAIGN_STATUS_LABELS, type CampaignWithStats } from './types';
import { formatCampaignDateTime } from './utils';

const STATUS_STYLES: Record<number, string> = {
  [CampaignStatus.Draft]: 'bg-[#f5f5f5] text-[#5c5c5c] border-transparent',
  [CampaignStatus.Scheduled]: 'bg-[#f4f8ff] text-[#3e87f8] border-transparent',
  [CampaignStatus.Sending]: 'bg-[#f2efff] text-[#7b61ff] border-transparent',
  [CampaignStatus.Paused]: 'bg-[#f4f8ff] text-[#3e87f8] border-transparent',
  [CampaignStatus.Stopped]: 'bg-[#fff0f0] text-[#f03232] border-transparent',
  [CampaignStatus.Completed]: 'bg-[#f2fff8] text-[#0fb75c] border-transparent',
  [CampaignStatus.SendingTestAb]: 'bg-[#fffdef] text-[#c0970c] border-transparent',
};

const TYPE_ICONS: Record<string, typeof Send> = {
  simple: Send,
  testAB: FlaskConical,
  split: GitBranch,
  recurring: RefreshCw,
};

const MESSAGE_TYPE_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  'web-push': Bell,
  'mobile-push': Smartphone,
  whatsapp: Phone,
};

interface UseCampaignsColumnsOptions {
  onDelete: (campaign: CampaignWithStats) => void;
  onDuplicate: (campaign: CampaignWithStats) => void;
  onPreviewMessage: (campaign: CampaignWithStats) => void;
  canDelete: boolean;
  canDuplicate: boolean;
}

export function useCampaignsColumns({
  onDelete,
  onDuplicate,
  onPreviewMessage,
  canDelete,
  canDuplicate,
}: UseCampaignsColumnsOptions): ColumnDef<CampaignWithStats, unknown>[] {
  const { t } = useTranslation();

  return useMemo(() => {
    const columns: ColumnDef<CampaignWithStats, unknown>[] = [
      {
        accessorKey: 'title',
        header: t('campaigns.title'),
        enableSorting: true,
        cell: ({ row }) => (
          <Link
            to="/campaigns/$campaignId"
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
          const isSending = status === CampaignStatus.Sending;
          const progress = row.original.sendingProgress;

          if (isSending && progress != null) {
            const pct = Math.min(progress, 100);
            return (
              <div className="relative inline-flex min-w-[116px] items-center justify-center overflow-hidden rounded-md border border-transparent bg-[#f2efff] px-2.5 py-0.5 text-xs font-semibold">
                <div
                  className="absolute inset-0 bg-[#d0c9f8] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative text-[#7b61ff]">
                  {t('campaigns.statusSending')}: {pct.toFixed(1)}%
                </span>
              </div>
            );
          }

          const labelKey = CAMPAIGN_STATUS_LABELS[status];
          return (
            <Badge className={cn('min-w-[116px] justify-center', STATUS_STYLES[status])}>
              {labelKey ? t(labelKey as never) : String(status)}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'type',
        header: t('campaigns.type'),
        enableSorting: true,
        cell: ({ row }) => {
          const type = row.original.type;
          const Icon = TYPE_ICONS[type] ?? Send;
          const label = t(`campaigns.type${capitalize(type)}` as never);
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Icon className="text-muted-foreground h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: 'messageType',
        header: t('campaigns.messageType'),
        enableSorting: true,
        cell: ({ row }) => {
          const msgType = row.original.messageType;
          const Icon = MESSAGE_TYPE_ICONS[msgType] ?? Mail;
          const labels: Record<string, string> = {
            email: 'Email',
            sms: 'SMS',
            'web-push': 'Web Push',
            'mobile-push': 'Mobile Push',
            whatsapp: 'WhatsApp',
          };
          const label = labels[msgType] ?? msgType;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Icon className="text-muted-foreground h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: 'scheduleTo',
        header: t('campaigns.scheduleTo'),
        enableSorting: true,
        cell: ({ row }) => formatCampaignDateTime(row.original.scheduleTo),
      },
      {
        id: 'tags',
        header: t('campaigns.filterTags'),
        enableSorting: false,
        cell: ({ row }) => {
          const { tags, sendToAll } = row.original;
          if (sendToAll) {
            return (
              <Badge className="border-transparent bg-[#f5f5f5] text-[10px] font-normal whitespace-nowrap text-[#5c5c5c]">
                {t('campaigns.sendToAll')}
              </Badge>
            );
          }
          if (!tags) return null;
          const entries = Array.isArray(tags) ? tags : Object.values(tags);
          if (!entries.length) return null;
          return (
            <div className="flex flex-wrap items-center gap-1">
              {entries.slice(0, 2).map((tag) => (
                <Badge
                  key={tag.id}
                  className="border-transparent bg-[#f5f5f5] text-[10px] font-normal whitespace-nowrap text-[#5c5c5c]"
                >
                  {tag.name}
                </Badge>
              ))}
              {entries.length > 2 && <span className="text-muted-foreground text-xs">…</span>}
            </div>
          );
        },
      },
      {
        accessorKey: 'sentContacts',
        header: () => <div className="text-right">{t('campaigns.sentContacts')}</div>,
        enableSorting: true,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{row.original.sentContacts?.toLocaleString() ?? '—'}</div>
        ),
      },
      {
        accessorKey: 'deliveredRate',
        header: () => <div className="text-right">{t('campaigns.deliveredRate')}</div>,
        enableSorting: false,
        cell: ({ row }) => <div className="text-right tabular-nums">{row.original.deliveredRate ?? '—'}</div>,
      },
      {
        accessorKey: 'openRate',
        header: () => <div className="text-right">{t('campaigns.openRate')}</div>,
        enableSorting: false,
        cell: ({ row }) => <div className="text-right tabular-nums">{row.original.openRate ?? '—'}</div>,
      },
      {
        accessorKey: 'ctr',
        header: () => <div className="text-right">{t('campaigns.ctr')}</div>,
        enableSorting: false,
        cell: ({ row }) => <div className="text-right tabular-nums">{row.original.ctr ?? '—'}</div>,
      },
      {
        accessorKey: 'ctor',
        header: () => <div className="text-right">{t('campaigns.ctor')}</div>,
        enableSorting: false,
        cell: ({ row }) => <div className="text-right tabular-nums">{row.original.ctor ?? '—'}</div>,
      },
      {
        accessorKey: 'unsubscribeCount',
        header: () => <div className="text-right">{t('campaigns.unsubscribe')}</div>,
        enableSorting: false,
        cell: ({ row }) => <div className="text-right tabular-nums">{row.original.unsubscribeCount ?? 0}</div>,
      },
      {
        accessorKey: 'bounceCount',
        header: () => <div className="text-right">{t('campaigns.bounce')}</div>,
        enableSorting: false,
        cell: ({ row }) => <div className="text-right tabular-nums">{row.original.bounceCount ?? 0}</div>,
      },
      {
        id: 'actions',
        meta: { sticky: 'right' },
        cell: ({ row }) => {
          const campaign = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onPreviewMessage(campaign)}>
                  <Eye className="mr-2 h-4 w-4" />
                  {t('campaigns.viewMessage')}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/analytics/dashboard"
                    search={{
                      campaigns: String(campaign.id),
                      channel: ['web-push', 'mobile-push'].includes(campaign.messageType)
                        ? ('web-push' as const)
                        : ('email' as const),
                    }}
                    target="_blank"
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    {t('campaigns.statistics')}
                  </Link>
                </DropdownMenuItem>
                {canDuplicate && (
                  <DropdownMenuItem onClick={() => onDuplicate(campaign)}>
                    <Copy className="mr-2 h-4 w-4" />
                    {t('campaigns.duplicate')}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(campaign)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('common.delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ];

    return columns;
  }, [t, onDelete, onDuplicate, onPreviewMessage, canDelete, canDuplicate]);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
