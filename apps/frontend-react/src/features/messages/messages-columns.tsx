import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageStatusBadge } from './components/message-status-badge';
import type { Message, MessageType, MessageStatus } from './types';
import { formatDateTime } from '@/lib/datetime';

function getEditRoute(messageType: MessageType): string {
  switch (messageType) {
    case 'email':
      return '/messages/email';
    case 'sms':
      return '/messages/sms';
    case 'web-push':
      return '/messages/web-push';
    case 'mobile-push':
      return '/messages/mobile-push';
    case 'whatsapp':
      return '/messages/whatsapp';
  }
}

interface UseMessagesColumnsOptions {
  messageType: MessageType;
  onDelete: (message: Message) => void;
  onDuplicate: (message: Message) => void;
  canDelete: boolean;
  canCreate: boolean;
}

export function useMessagesColumns({
  messageType,
  onDelete,
  onDuplicate,
  canDelete,
  canCreate,
}: UseMessagesColumnsOptions): ColumnDef<Message, unknown>[] {
  const { t } = useTranslation();

  return useMemo(() => {
    const baseRoute = getEditRoute(messageType);

    const columns: ColumnDef<Message, unknown>[] = [
      {
        accessorKey: 'title',
        header: t('messages.title'),
        enableSorting: true,
        cell: ({ row }) => (
          <div>
            <Link
              to={`${baseRoute}/$messageId` as string}
              params={{ messageId: String(row.original.id) }}
              className="text-primary font-medium hover:underline"
            >
              {row.original.title}
            </Link>
            {row.original.description && (
              <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{row.original.description}</p>
            )}
          </div>
        ),
      },
    ];

    if (messageType === 'email') {
      columns.push(
        {
          id: 'fromName',
          accessorKey: 'fromMail',
          header: t('messages.sender'),
          enableSorting: true,
          cell: ({ row }) => {
            const { fromName, fromMail } = row.original;
            if (!fromName && !fromMail) return '—';
            return (
              <div>
                <p className="text-sm">{fromName || '—'}</p>
                {fromMail && <p className="text-muted-foreground text-xs">{fromMail}</p>}
              </div>
            );
          },
        },
        {
          accessorKey: 'subject',
          header: t('messages.subject'),
          enableSorting: true,
        },
      );
    }

    if (messageType === 'whatsapp') {
      columns.push(
        {
          accessorKey: 'status',
          header: t('messages.status'),
          enableSorting: false,
          cell: ({ row }) => {
            const status = row.original.status as MessageStatus | undefined;
            if (!status) return '—';
            return <MessageStatusBadge status={status} />;
          },
        },
        {
          accessorKey: 'templateCategory',
          header: t('messages.templateCategory'),
          enableSorting: true,
          cell: ({ row }) => {
            const cat = row.original.templateCategory;
            if (!cat) return t('messages.templateCategoryMarketing');
            if (cat === 'MARKETING') return t('messages.templateCategoryMarketing');
            if (cat === 'UTILITY') return t('messages.templateCategoryUtility');
            return cat;
          },
        },
        {
          accessorKey: 'whatsappType',
          header: t('messages.contentType'),
          enableSorting: true,
          cell: ({ row }) => {
            const wType = row.original.whatsappType;
            if (!wType) return '—';
            if (wType === 'text') return t('messages.contentTypeText');
            if (wType === 'call-to-action' || wType === 'call_to_action') return t('messages.contentTypeCallToAction');
            return wType;
          },
        },
      );
    }

    columns.push({
      accessorKey: 'updatedAt',
      header: t('messages.updatedAt'),
      enableSorting: true,
      cell: ({ row }) => formatDateTime(row.original.updatedAt),
    });

    columns.push({
      id: 'actions',
      cell: ({ row }) => {
        const editLabel = t('common.edit');
        const duplicateLabel = t('messages.duplicate');
        const deleteLabel = t('common.deleteEntity', {
          entity: t('messages.entityName'),
        });

        return (
          <div className="flex justify-end gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs" asChild>
                    <Link to={`${baseRoute}/$messageId` as string} params={{ messageId: String(row.original.id) }}>
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">{editLabel}</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{editLabel}</TooltipContent>
              </Tooltip>

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
            </TooltipProvider>
          </div>
        );
      },
    });

    return columns;
  }, [t, messageType, onDelete, onDuplicate, canDelete, canCreate]);
}
