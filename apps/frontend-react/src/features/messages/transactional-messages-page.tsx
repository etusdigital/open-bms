import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { Mail, Plus, Pencil, Trash2, Copy, MessageSquare, Smartphone, Bell, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useListSearchParams, type ListSearchParams } from '@/hooks/use-list-search-params';
import { usePermissions } from '@/hooks/use-permissions';
import { useMessagesList, useDeleteMessage, useDuplicateMessage } from './use-messages';
import { TRANSACTIONAL_TYPES, baseMessageType, type Message, type MessageType, type AnyMessageType } from './types';
import { formatDateTime } from '@/lib/datetime';

const EMPTY_ARRAY: Message[] = [];

/** Icon component for each base channel */
const CHANNEL_ICONS: Record<MessageType, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  'web-push': Bell,
  'mobile-push': Smartphone,
  whatsapp: Phone,
};

interface TransactionalMessagesPageProps {
  searchParams: ListSearchParams;
}

export default function TransactionalMessagesPage({ searchParams }: TransactionalMessagesPageProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canCreate = can('messages:create');
  const canDelete = can('messages:delete');

  const { pagination, sorting, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const query = useMessagesList(searchParams, TRANSACTIONAL_TYPES);
  const deleteMessage = useDeleteMessage();
  const duplicateMessage = useDuplicateMessage();

  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);

  const handleDelete = useCallback((message: Message) => {
    setDeleteTarget(message);
  }, []);

  const handleDuplicate = useCallback(
    (message: Message) => {
      duplicateMessage.mutate(message.id);
    },
    [duplicateMessage],
  );

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMessage.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        const data = query.data?.data ?? [];
        if (data.length === 1 && searchParams.page > 1) {
          setPagination((prev) => ({
            ...prev,
            pageIndex: prev.pageIndex - 1,
          }));
        }
      },
    });
  }, [deleteTarget, deleteMessage, query.data?.data, searchParams.page, setPagination]);

  const columns = useMemo<ColumnDef<Message, unknown>[]>(() => {
    return [
      {
        id: 'type',
        header: t('messages.channel'),
        cell: ({ row }) => {
          const channel = baseMessageType(row.original.type as AnyMessageType);
          const Icon = CHANNEL_ICONS[channel];
          return (
            <div className="text-muted-foreground flex items-center gap-2">
              <Icon className="h-4 w-4" />
            </div>
          );
        },
      },
      {
        accessorKey: 'title',
        header: t('messages.title'),
        enableSorting: true,
        cell: ({ row }) => {
          const channel = baseMessageType(row.original.type as AnyMessageType);
          return (
            <div>
              <Link
                to={`/messages/transactional/${channel}/${row.original.id}`}
                className="text-primary font-medium hover:underline"
              >
                {row.original.title}
              </Link>
              {row.original.description && (
                <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{row.original.description}</p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'updatedAt',
        header: t('messages.updatedAt'),
        enableSorting: true,
        cell: ({ row }) => formatDateTime(row.original.updatedAt),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const channel = baseMessageType(row.original.type as AnyMessageType);
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
                      <Link to={`/messages/transactional/${channel}/${row.original.id}`}>
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
                      <Button variant="ghost" size="icon-xs" onClick={() => handleDuplicate(row.original)}>
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
                        onClick={() => handleDelete(row.original)}
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
  }, [t, canCreate, canDelete, handleDelete, handleDuplicate]);

  const data = query.data?.data ?? EMPTY_ARRAY;
  const totalRows = query.data?.meta.total ?? 0;
  const totalPages = Math.ceil(totalRows / searchParams.pageSize);

  const table = useReactTable({
    columns,
    data,
    rowCount: totalRows,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  const isEmpty = !query.isLoading && data.length === 0;

  return (
    <>
      <ListPage.Root>
        <ListPage.Header title={t('sidebar.transactional')}>
          {canCreate && (
            <Button size="sm" asChild>
              <Link to="/messages/transactional/email/create">
                <Plus className="mr-1 h-4 w-4" />
                {t('messages.createMessage')}
              </Link>
            </Button>
          )}
        </ListPage.Header>

        <ListPage.Toolbar>
          <DataTableSearch value={searchParams.search} onChange={setSearch} />
        </ListPage.Toolbar>

        {isEmpty ? (
          <ListPage.Empty>
            <DataTableEmptyState
              entityName={t('messages.entityNamePlural')}
              hasSearch={searchParams.search.length > 0}
              onClearSearch={() => setSearch('')}
              icon={Mail}
            />
          </ListPage.Empty>
        ) : (
          <>
            <ListPage.Content>
              <DataTable
                columns={columns}
                table={table}
                isLoading={query.isLoading}
                isFetching={query.isFetching}
                error={query.error}
                onRetry={() => query.refetch()}
              />
            </ListPage.Content>

            <ListPage.Pagination>
              <DataTablePagination
                currentPage={searchParams.page}
                totalPages={totalPages}
                pageSize={searchParams.pageSize}
                totalRows={totalRows}
                onPageChange={(page) => setPagination((prev) => ({ ...prev, pageIndex: page - 1 }))}
                onPageSizeChange={(size) => setPagination({ pageIndex: 0, pageSize: size })}
              />
            </ListPage.Pagination>
          </>
        )}
      </ListPage.Root>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('common.deleteConfirmTitle', { entity: t('messages.entityName') })}
        description={t('common.deleteConfirmMessage', {
          name: deleteTarget?.title ?? '',
        })}
        onConfirm={confirmDelete}
        loading={deleteMessage.isPending}
      />
    </>
  );
}
