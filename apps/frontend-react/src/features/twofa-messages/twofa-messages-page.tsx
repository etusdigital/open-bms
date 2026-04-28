import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ShieldCheck, Plus } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { usePermissions } from '@/hooks/use-permissions';
import { useAppStore } from '@/stores/app-store';
import { useTwoFASettings, useUpdateTwoFASettings, useTwoFAStatistics } from './use-twofa-messages';
import { useTwoFAGroupsColumns } from './twofa-groups-columns';
import {
  TWO_FA_CHANNELS,
  TWO_FA_CHANNEL_LABELS,
  type TwoFAChannel,
  type TwoFASettings,
  type TwoFAGroupConfig,
  type TwoFAGroupRow,
} from './types';

const EMPTY_CHANNEL_GROUPS: Record<string, TwoFAGroupConfig[]> = {};

function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export default function TwoFAMessagesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('messages:create');
  const canDelete = can('messages:delete');

  const hasEmail = useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return false;
    const c = s.auth.accountConfigs.find((c) => c.name === 'email_settings');
    if (!c) return false;
    try {
      return JSON.parse(c.value)?.isActive === true;
    } catch {
      return false;
    }
  });
  const hasSms = useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return false;
    const c = s.auth.accountConfigs.find((c) => c.name === 'sms_settings');
    if (!c) return false;
    try {
      return JSON.parse(c.value)?.isActive === true;
    } catch {
      return false;
    }
  });
  const hasWhatsapp = useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return false;
    const c = s.auth.accountConfigs.find((c) => c.name === 'whatsapp_settings');
    if (!c) return false;
    try {
      return JSON.parse(c.value)?.isActive === true;
    } catch {
      return false;
    }
  });

  const availableChannels = useMemo(
    () => TWO_FA_CHANNELS.filter((ch) => (ch === 'email' ? hasEmail : ch === 'sms' ? hasSms : hasWhatsapp)),
    [hasEmail, hasSms, hasWhatsapp],
  );

  const [channel, setChannel] = useState<TwoFAChannel>(() => availableChannels[0] ?? 'email');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Date range for statistics (default last 7 days)
  const endDate = formatDate(new Date());
  const startDate = formatDate(subDays(new Date(), 7));

  // Read groups from account config
  const settings = useTwoFASettings();
  const updateSettings = useUpdateTwoFASettings();

  const channelGroups = settings?.[channel] ?? EMPTY_CHANNEL_GROUPS;
  const groupNames = useMemo(() => Object.keys(channelGroups), [channelGroups]);

  // Fetch statistics for all groups
  const statsQuery = useTwoFAStatistics(channel, groupNames, startDate, endDate);

  // Merge groups + stats into table rows
  const groupRows = useMemo<TwoFAGroupRow[]>(() => {
    const stats = statsQuery.data ?? [];
    return groupNames.map((groupName) => {
      const groupStats = stats.filter((s) => s.group === groupName);
      const totals = groupStats.reduce(
        (acc, s) => ({
          countSuccess: acc.countSuccess + s.countSuccess,
          countError: acc.countError + s.countError,
          countVerifyValidated: acc.countVerifyValidated + s.countVerifyValidated,
          countVerifyRejected: acc.countVerifyRejected + s.countVerifyRejected,
        }),
        { countSuccess: 0, countError: 0, countVerifyValidated: 0, countVerifyRejected: 0 },
      );
      return { groupName, ...totals };
    });
  }, [groupNames, statsQuery.data]);

  const handleGroupClick = useCallback(
    (groupName: string) => {
      navigate({ to: `/messages/2fa/${channel}/${groupName}` as string });
    },
    [navigate, channel],
  );

  const handleDelete = useCallback((groupName: string) => {
    setDeleteTarget(groupName);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget || !settings) return;
    const updated: TwoFASettings = {
      ...(settings as TwoFASettings),
      [channel]: { ...(settings as TwoFASettings)[channel] },
    };
    delete (updated[channel] as Record<string, unknown>)[deleteTarget];
    updateSettings.mutate(updated, {
      onSuccess: () => setDeleteTarget(null),
    });
  }, [deleteTarget, settings, channel, updateSettings]);

  const handleCreate = () => {
    navigate({ to: `/messages/2fa/${channel}/new-group` as string });
  };

  const columns = useTwoFAGroupsColumns({
    onGroupClick: handleGroupClick,
    onDelete: handleDelete,
    canDelete,
  });

  const table = useReactTable({
    columns,
    data: groupRows,
    getCoreRowModel: getCoreRowModel(),
  });

  const isEmpty = groupRows.length === 0 && !statsQuery.isLoading;

  return (
    <>
      <ListPage.Root>
        <ListPage.Header title={t('twofaMessages.pageTitle')}>
          {canCreate && (
            <Button size="sm" onClick={handleCreate}>
              <Plus className="mr-1 h-4 w-4" />
              {t('twofaMessages.createGroup')}
            </Button>
          )}
        </ListPage.Header>

        <ListPage.Toolbar>
          <div className="flex items-center gap-2">
            {availableChannels.map((ch) => (
              <Button
                key={ch}
                variant={channel === ch ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChannel(ch)}
              >
                {TWO_FA_CHANNEL_LABELS[ch]}
              </Button>
            ))}
          </div>
        </ListPage.Toolbar>

        {isEmpty ? (
          <ListPage.Empty>
            <DataTableEmptyState
              entityName={t('twofaMessages.groups')}
              hasSearch={false}
              onClearSearch={() => {}}
              icon={ShieldCheck}
            />
          </ListPage.Empty>
        ) : (
          <ListPage.Content>
            <DataTable
              columns={columns}
              table={table}
              isLoading={statsQuery.isLoading}
              isFetching={statsQuery.isFetching}
              error={statsQuery.error}
              onRetry={() => statsQuery.refetch()}
            />
          </ListPage.Content>
        )}
      </ListPage.Root>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('twofaMessages.deleteGroupTitle')}
        description={t('twofaMessages.deleteGroupConfirm')}
        onConfirm={confirmDelete}
        loading={updateSettings.isPending}
      />
    </>
  );
}
