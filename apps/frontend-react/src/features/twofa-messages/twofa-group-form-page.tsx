import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronLeft } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListPage } from '@/components/list-page';
import { Skeleton } from '@/components/ui/skeleton';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import {
  useTwoFASettings,
  useUpdateTwoFASettings,
  useTwoFAStatistics,
  useTwoFAMessageOptions,
  useTwoFAMessageStatistics,
} from './use-twofa-messages';
import { validateGroupConfigs, groupNameSchema } from './twofa-settings-schema';
import { TwoFAMessageCard, type MessageStatistic } from './components/twofa-message-card';
import { TwoFAStatisticsCard } from './components/twofa-statistics-card';
import { TwoFAMessagePreviewDialog } from './components/twofa-message-preview-dialog';
import type { TwoFAChannel, TwoFASettings, TwoFAGroupConfig, TwoFAMessageRef } from './types';
import type { Message } from '@/features/messages/types';

const EMPTY_MESSAGES: Message[] = [];

interface TwoFAGroupFormPageProps {
  channel: TwoFAChannel;
  groupName?: string; // undefined = new group
  initialGroupName?: string; // for new-group route when returning from create message
  newMessageId?: number; // auto-add this message after returning from create
}

type DatePreset = 'today' | 'yesterday' | 'last7Days' | 'last30Days';

const DATE_PRESETS: DatePreset[] = ['today', 'yesterday', 'last7Days', 'last30Days'];

function getDateRange(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  switch (preset) {
    case 'today':
      return { startDate: fmt(now), endDate: fmt(now) };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { startDate: fmt(y), endDate: fmt(y) };
    }
    case 'last7Days':
      return { startDate: fmt(subDays(now, 7)), endDate: fmt(now) };
    case 'last30Days':
      return { startDate: fmt(subDays(now, 30)), endDate: fmt(now) };
  }
}

export default function TwoFAGroupFormPage({
  channel,
  groupName,
  initialGroupName,
  newMessageId,
}: TwoFAGroupFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const isNewGroup = !groupName;
  const settings = useTwoFASettings();
  const updateSettings = useUpdateTwoFASettings();
  const messagesQuery = useTwoFAMessageOptions(channel);

  // Invalidate messages cache when arriving with a new message to ensure it's in the list
  useEffect(() => {
    if (newMessageId) {
      queryClient.invalidateQueries({ queryKey: ['twofa-messages'] });
    }
  }, [newMessageId, queryClient]);

  // Local form state
  const [name, setName] = useState(groupName ?? initialGroupName ?? '');
  const [configs, setConfigs] = useState<TwoFAGroupConfig[]>(() => {
    if (!groupName || !settings) return [];
    return (settings[channel] as Record<string, TwoFAGroupConfig[]>)?.[groupName] ?? [];
  });
  const [datePreset, setDatePreset] = useState<DatePreset>('last7Days');
  const [nameError, setNameError] = useState<string | null>(null);
  const [previewMessageId, setPreviewMessageId] = useState<number | null>(null);

  // Track initial state for dirty detection
  const initialState = useRef({
    name: groupName ?? initialGroupName ?? '',
    configs: JSON.stringify(configs),
  });

  const isDirty = useMemo(() => {
    return name !== initialState.current.name || JSON.stringify(configs) !== initialState.current.configs;
  }, [name, configs]);

  const { startDate, endDate } = getDateRange(datePreset);

  // Statistics (only for existing groups)
  const statsGroups = useMemo(() => (groupName ? [groupName] : []), [groupName]);
  const statsQuery = useTwoFAStatistics(channel, statsGroups, startDate, endDate);
  const groupStats = useMemo(() => {
    if (!statsQuery.data?.length) return null;
    return statsQuery.data.reduce(
      (acc, s) => ({
        countTotal: acc.countTotal + s.countTotal,
        countSuccess: acc.countSuccess + s.countSuccess,
        countError: acc.countError + s.countError,
        countVerifyValidated: acc.countVerifyValidated + s.countVerifyValidated,
        countVerifyRejected: acc.countVerifyRejected + s.countVerifyRejected,
      }),
      {
        countTotal: 0,
        countSuccess: 0,
        countError: 0,
        countVerifyValidated: 0,
        countVerifyRejected: 0,
      },
    );
  }, [statsQuery.data]);

  // Per-message delivery statistics
  const messageIds = useMemo(() => configs.map((c) => c.message?.id).filter(Boolean) as number[], [configs]);
  const msgStatsQuery = useTwoFAMessageStatistics(messageIds, channel, startDate, endDate);

  const getMessageStats = useCallback(
    (messageId: number): MessageStatistic[] => {
      const data = msgStatsQuery.data;
      if (!data) return [];
      const entry = data[String(messageId)] as { general?: Record<string, number> } | undefined;
      if (!entry?.general) return [];
      const g = entry.general;
      if (channel === 'email') {
        const delivered = g.delivered ?? 0;
        return [
          { title: t('twofaMessages.delivered'), total: delivered, percentage: 0 },
          {
            title: t('twofaMessages.open'),
            total: g.open ?? 0,
            percentage: delivered > 0 ? Number((((g.open ?? 0) / delivered) * 100).toFixed(2)) : 0,
          },
          {
            title: t('twofaMessages.bounce'),
            total: g.bounce ?? 0,
            percentage: delivered > 0 ? Number((((g.bounce ?? 0) / delivered) * 100).toFixed(2)) : 0,
          },
          {
            title: t('twofaMessages.unsubscribe'),
            total: g.unsubscribe ?? 0,
            percentage: delivered > 0 ? Number((((g.unsubscribe ?? 0) / delivered) * 100).toFixed(2)) : 0,
          },
        ];
      }
      return [
        { title: t('twofaMessages.delivered'), total: g.delivered ?? 0, percentage: 0 },
        { title: t('twofaMessages.sent'), total: g.sent ?? 0, percentage: 0 },
      ];
    },
    [msgStatsQuery.data, channel, t],
  );

  // Available messages (exclude already selected)
  const allMessages = messagesQuery.data?.data ?? EMPTY_MESSAGES;
  const selectedIds = useMemo(() => new Set(configs.map((c) => c.message?.id).filter(Boolean)), [configs]);
  const availableMessages = useMemo(
    () => allMessages.filter((m) => !selectedIds.has(m.id)),
    [allMessages, selectedIds],
  );

  // Auto-add newly created message when returning from create-message route
  useEffect(() => {
    if (!newMessageId || !allMessages.length) return;
    if (configs.some((c) => c.message?.id === newMessageId)) return;
    const msg = allMessages.find((m) => m.id === newMessageId);
    if (!msg) return;
    setConfigs((prev) => [
      ...prev,
      {
        message: {
          id: msg.id,
          title: msg.title,
          subject: msg.subject,
          fromName: msg.fromName,
          url: msg.url,
        },
        percentage: 0,
      },
    ]);
  }, [newMessageId, allMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Validation
  const validation = useMemo(() => validateGroupConfigs(configs), [configs]);

  const validateName = useCallback(
    (value: string) => {
      const result = groupNameSchema.safeParse(value);
      if (!result.success) {
        setNameError(t('twofaMessages.groupNameSpecialChars'));
        return false;
      }
      if (settings && value !== groupName) {
        const existingGroups = Object.keys(settings[channel] ?? {});
        if (existingGroups.includes(value)) {
          setNameError(t('twofaMessages.groupNameExists'));
          return false;
        }
      }
      setNameError(null);
      return true;
    },
    [settings, channel, groupName, t],
  );

  const handleNameBlur = () => {
    if (name) validateName(name);
  };

  const addCard = () => {
    setConfigs((prev) => [...prev, { message: null as unknown as TwoFAMessageRef, percentage: 0 }]);
  };

  const handleCreateMessage = () => {
    navigate({
      to: `/messages/2fa/${channel}/create-message` as string,
      search: { groupName: name, isNewGroup },
    });
  };

  const handleEditMessage = (messageId: number) => {
    navigate({
      to: `/messages/2fa/${channel}/edit/${messageId}` as string,
      search: { groupName: name, isNewGroup },
    });
  };

  const removeCard = (index: number) => {
    setConfigs((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCardMessage = (index: number, message: TwoFAMessageRef | null) => {
    setConfigs((prev) => prev.map((c, i) => (i === index ? { ...c, message: message! } : c)));
  };

  const updateCardPercentage = (index: number, percentage: number) => {
    setConfigs((prev) => prev.map((c, i) => (i === index ? { ...c, percentage } : c)));
  };

  const canSave = useMemo(() => {
    if (!name || nameError) return false;
    if (configs.length === 0) return false;
    return validation.valid;
  }, [name, nameError, configs.length, validation.valid]);

  const handleSave = () => {
    if (!canSave) return;
    if (!validateName(name)) return;

    const base = (settings ?? { email: {}, sms: {}, whatsapp: {} }) as TwoFASettings;

    const updatedChannelGroups = { ...(base[channel] ?? {}) };

    if (groupName && groupName !== name) {
      delete updatedChannelGroups[groupName];
    }

    updatedChannelGroups[name] = configs;

    const updated: TwoFASettings = {
      ...base,
      [channel]: updatedChannelGroups,
    };

    updateSettings.mutate(updated, {
      onSuccess: () => {
        // Reset dirty state before navigating
        initialState.current = { name, configs: JSON.stringify(configs) };
        navigate({ to: '/messages/2fa' });
      },
    });
  };

  const handleReturn = () => {
    navigate({ to: '/messages/2fa' });
  };

  return (
    <ListPage.Root>
      <ListPage.Header title={isNewGroup ? t('twofaMessages.createGroup') : t('twofaMessages.editGroup')} />

      <ListPage.Content>
        <div className="p-6">
          {/* Back link */}
          <button className="text-primary mb-4 flex items-center gap-1 text-sm hover:underline" onClick={handleReturn}>
            <ChevronLeft className="h-4 w-4" />
            {t('twofaMessages.pageTitle')}
          </button>

          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            {/* Left: Form */}
            <div className="space-y-6">
              {/* Group name */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">{t('twofaMessages.group')}:</label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  onBlur={handleNameBlur}
                  placeholder={t('twofaMessages.typeGroupName')}
                  className="max-w-md"
                  autoFocus={isNewGroup}
                />
                {nameError && <p className="text-destructive text-sm">{nameError}</p>}
              </div>

              {/* Settings label */}
              <h3 className="text-muted-foreground text-sm font-semibold">{t('twofaMessages.settings')}</h3>

              {/* Message cards */}
              <div className="space-y-3">
                {configs.map((config, index) => (
                  <TwoFAMessageCard
                    key={index}
                    message={config.message?.id ? config.message : null}
                    percentage={config.percentage}
                    availableMessages={availableMessages}
                    statistics={config.message?.id ? getMessageStats(config.message.id) : undefined}
                    onMessageChange={(msg) => updateCardMessage(index, msg)}
                    onPercentageChange={(pct) => updateCardPercentage(index, pct)}
                    onRemove={() => removeCard(index)}
                    onEdit={config.message?.id ? () => handleEditMessage(config.message.id) : undefined}
                    onPreview={config.message?.id ? () => setPreviewMessageId(config.message.id) : undefined}
                  />
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCreateMessage} disabled={!name}>
                  <Plus className="mr-1 h-4 w-4" />
                  {t('twofaMessages.createMessage')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addCard}
                  disabled={!name || availableMessages.length === 0}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {t('twofaMessages.addConfiguration')}
                </Button>
              </div>

              {/* Percentage validation warning */}
              {configs.length > 0 && !validation.valid && validation.error && (
                <p className="text-destructive text-sm">
                  {validation.error.includes('100%')
                    ? t('twofaMessages.percentageMustEqual100', { current: validation.total })
                    : validation.error}
                </p>
              )}

              {/* Save / Return */}
              <div className="flex items-center gap-4 pt-4">
                <button className="text-primary text-sm font-semibold uppercase" onClick={handleReturn}>
                  {t('twofaMessages.return')}
                </button>
                <Button onClick={handleSave} disabled={!canSave || updateSettings.isPending}>
                  {updateSettings.isPending ? t('common.loading') : t('common.save')}
                </Button>
              </div>
            </div>

            {/* Right: Statistics (existing groups only) */}
            {!isNewGroup && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">{t('twofaMessages.statisticsFrom')}</span>
                  <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_PRESETS.map((preset) => (
                        <SelectItem key={preset} value={preset}>
                          {t(`twofaMessages.${preset}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {statsQuery.isLoading ? (
                  <Skeleton className="h-[200px] w-full rounded-lg" />
                ) : groupStats ? (
                  <TwoFAStatisticsCard period={t(`twofaMessages.${datePreset}`)} {...groupStats} />
                ) : null}
              </div>
            )}
          </div>
        </div>
      </ListPage.Content>

      {/* Preview dialog */}
      {previewMessageId && (
        <TwoFAMessagePreviewDialog
          messageId={previewMessageId}
          channel={channel}
          open={true}
          onOpenChange={(open) => {
            if (!open) setPreviewMessageId(null);
          }}
        />
      )}

      {/* Unsaved changes protection */}
      <UnsavedChangesDialog isDirty={isDirty} isPending={updateSettings.isPending} />
    </ListPage.Root>
  );
}
