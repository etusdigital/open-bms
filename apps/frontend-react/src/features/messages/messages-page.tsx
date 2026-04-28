import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Mail, Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { cn } from '@/lib/utils';
import { useListSearchParams, type ListSearchParams } from '@/hooks/use-list-search-params';
import { usePermissions } from '@/hooks/use-permissions';
import { useAppStore, selectAccountChannels } from '@/stores/app-store';
import {
  useMessagesList,
  useDeleteMessage,
  useDuplicateMessage,
  usePoolsForSelect,
  useAutomationsForSelect,
  type MessagesListFilters,
} from './use-messages';
import { useMessagesColumns } from './messages-columns';
import { MESSAGE_TYPE_LABELS, type Message, type MessageType } from './types';
import type { AccountChannels } from '@/types';

const EMPTY_ARRAY: Message[] = [];

const CHANNEL_TABS: { type: MessageType; channelKey: keyof AccountChannels }[] = [
  { type: 'email', channelKey: 'email' },
  { type: 'web-push', channelKey: 'webPush' },
  { type: 'mobile-push', channelKey: 'mobilePush' },
  { type: 'sms', channelKey: 'sms' },
  { type: 'whatsapp', channelKey: 'whatsapp' },
];

interface MessagesPageProps {
  searchParams: ListSearchParams;
  messageType: MessageType;
  onTypeChange?: (type: MessageType) => void;
  sender?: string;
  automationId?: number;
  onSenderChange?: (sender: string) => void;
  onAutomationChange?: (automationId: string) => void;
}

function getCreateRoute(messageType: MessageType): string {
  switch (messageType) {
    case 'email':
      return '/messages/email/create';
    case 'sms':
      return '/messages/sms/create';
    case 'web-push':
      return '/messages/web-push/create';
    case 'mobile-push':
      return '/messages/mobile-push/create';
    case 'whatsapp':
      return '/messages/whatsapp/create';
  }
}

export default function MessagesPage({
  searchParams,
  messageType,
  onTypeChange,
  sender,
  automationId,
  onSenderChange,
  onAutomationChange,
}: MessagesPageProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canCreate = can('messages:create');
  const canDelete = can('messages:delete');
  const channels = useAppStore(useShallow(selectAccountChannels));

  const isEmail = messageType === 'email';

  // Filters for email only
  const filters: MessagesListFilters | undefined = useMemo(() => {
    if (!isEmail) return undefined;
    const f: MessagesListFilters = {};
    if (sender) f.sender = sender;
    if (automationId) f.automationId = automationId;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [isEmail, sender, automationId]);

  const { pagination, sorting, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const query = useMessagesList(searchParams, messageType, filters);
  const deleteMessage = useDeleteMessage();
  const duplicateMessage = useDuplicateMessage();

  // Fetch pools and automations for email filter selects
  const poolsQuery = usePoolsForSelect();
  const automationsQuery = useAutomationsForSelect();

  // Build sender options from pools (value = poolName for ipPool param, label = senderEmail)
  const senderOptions = useMemo(() => {
    const pools = poolsQuery.data ?? [];
    const seen = new Set<string>();
    return pools
      .filter((p) => {
        if (!p.poolName || seen.has(p.poolName)) return false;
        seen.add(p.poolName);
        return true;
      })
      .map((p) => ({ value: p.poolName, label: p.senderEmail || p.poolName }));
  }, [poolsQuery.data]);

  const automationOptions = useMemo(() => {
    const automations = automationsQuery.data ?? [];
    return automations.map((a) => ({ value: String(a.id), label: a.title }));
  }, [automationsQuery.data]);

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

  const columns = useMessagesColumns({
    messageType,
    onDelete: handleDelete,
    onDuplicate: handleDuplicate,
    canDelete,
    canCreate,
  });

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

  // Filter tabs to only show enabled channels
  const enabledTabs = CHANNEL_TABS.filter((tab) => channels[tab.channelKey]);

  return (
    <>
      <ListPage.Root>
        <ListPage.Header title={t('sidebar.messages')}>
          {canCreate && (
            <Button size="sm" asChild>
              <Link to={getCreateRoute(messageType)}>
                <Plus className="mr-1 h-4 w-4" />
                {t('messages.createMessage')}
              </Link>
            </Button>
          )}
        </ListPage.Header>

        {/* Channel type tabs */}
        {onTypeChange && enabledTabs.length > 1 && (
          <div className="flex gap-1 border-b px-1">
            {enabledTabs.map(({ type }) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  if (type !== messageType) onTypeChange(type);
                }}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium transition-colors',
                  type === messageType
                    ? 'border-primary text-primary border-b-2'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {MESSAGE_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        )}

        <ListPage.Toolbar>
          <DataTableSearch value={searchParams.search} onChange={setSearch} />
          {/* Email-specific filters */}
          {isEmail && onSenderChange && (
            <>
              <Select value={sender || '_all'} onValueChange={(val) => onSenderChange(val === '_all' ? '' : val)}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder={t('messages.selectSenderFilter')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t('messages.allSenders')}</SelectItem>
                  {senderOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          {isEmail && onAutomationChange && (
            <Select
              value={automationId ? String(automationId) : '_all'}
              onValueChange={(val) => onAutomationChange(val === '_all' ? '' : val)}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder={t('messages.selectAutomationFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">{t('messages.allAutomations')}</SelectItem>
                {automationOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
