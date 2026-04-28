import { useMemo } from 'react';
import { Trash2, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Message } from '@/features/messages/types';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

interface UseTwoFAMessagesColumnsOptions {
  onDelete: (message: Message) => void;
  onDuplicate: (message: Message) => void;
  canDelete: boolean;
  canCreate: boolean;
}

export function useTwoFAMessagesColumns({
  onDelete,
  onDuplicate,
  canDelete,
  canCreate,
}: UseTwoFAMessagesColumnsOptions): ColumnDef<Message, unknown>[] {
  const { t } = useTranslation();

  return useMemo(() => {
    const columns: ColumnDef<Message, unknown>[] = [
      {
        accessorKey: 'title',
        header: t('twofaMessages.title'),
        enableSorting: true,
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        accessorKey: 'updatedAt',
        header: t('twofaMessages.updatedAt'),
        enableSorting: true,
        cell: ({ row }) => formatDate(row.original.updatedAt),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const _editLabel = t('common.edit');
          const duplicateLabel = t('twofaMessages.duplicate');
          const deleteLabel = t('common.deleteEntity', {
            entity: t('twofaMessages.entityName'),
          });

          return (
            <div className="flex justify-end gap-1">
              <TooltipProvider>
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
      },
    ];

    return columns;
  }, [t, onDelete, onDuplicate, canDelete, canCreate]);
}
