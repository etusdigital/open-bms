import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { useAccountId, useUpdateAccountConfigs } from '@/features/settings/use-settings';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { Message } from '@/features/messages/types';
import type { TwoFAChannel, TwoFASettings, TwoFAStatistic } from './types';
import { toApiType, toVerifyMethod } from './types';
import { twoFASettingsSchema } from './twofa-settings-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchTwoFAMessagesList(
  params: ListSearchParams,
  channel: TwoFAChannel,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Message>> {
  const { data } = await apiClient.get<RawPaginatedResponse<Message>>('/messages', {
    params: {
      page: params.page,
      itemsPerPage: params.pageSize,
      type: toApiType(channel),
      ...(params.search && { title: params.search }),
      ...(params.sort && { sortBy: params.sort, order: params.order }),
    },
    signal,
  });
  return toPaginatedResponse(data);
}

export function useTwoFAMessagesList(params: ListSearchParams, channel: TwoFAChannel) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['twofa-messages', 'list', { accountId, channel, ...params }],
    queryFn: ({ signal }) => fetchTwoFAMessagesList(params, channel, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useDeleteTwoFAMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/messages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twofa-messages'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('twofaMessages.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('twofaMessages.entityName') }),
      );
    },
  });
}

export function useDuplicateTwoFAMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<Message>(`/messages/${id}/copy`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twofa-messages'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
      toast.success(i18n.t('twofaMessages.duplicateSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('twofaMessages.duplicateError'));
    },
  });
}

// --- 2FA Settings (Groups) ---

/** Fetch 2FA settings via dedicated endpoint (not in auth store — hidden by backend sanitizer) */
export function useTwoFASettings() {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  const query = useQuery({
    queryKey: ['twofa-settings', { accountId }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<{ value: unknown }[]>('/accounts/config/2fa_settings', {
        signal,
      });
      const raw = data?.[0]?.value;
      if (!raw) return null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const result = twoFASettingsSchema.safeParse(parsed);
      return result.success ? result.data : null;
    },
    enabled: auth.status === 'authenticated',
    staleTime: 30_000,
  });

  return query.data ?? null;
}

/** Save 2FA settings to account config */
export function useUpdateTwoFASettings() {
  const accountId = useAccountId();
  const updateConfigs = useUpdateAccountConfigs();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: TwoFASettings) => {
      await updateConfigs.mutateAsync({
        accountId,
        configs: [
          {
            account_id: accountId,
            name: '2fa_settings',
            value: settings as unknown as string, // backend expects object, not stringified JSON (matches Vue behavior)
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twofa-settings'] });
      toast.success(i18n.t('twofaMessages.settingsSaved'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('twofaMessages.settingsSaveError'));
    },
  });
}

interface RawTwoFAStatistic {
  date: string;
  method: string;
  group: string;
  count_total: number | string;
  count_success: number | string;
  count_error: number | string;
  count_verify_validated: number | string;
  count_verify_rejected: number | string;
}

function normalizeStat(raw: RawTwoFAStatistic): TwoFAStatistic {
  return {
    date: raw.date,
    method: raw.method.toLowerCase(),
    group: raw.group,
    countTotal: Number(raw.count_total) || 0,
    countSuccess: Number(raw.count_success) || 0,
    countError: Number(raw.count_error) || 0,
    countVerifyValidated: Number(raw.count_verify_validated) || 0,
    countVerifyRejected: Number(raw.count_verify_rejected) || 0,
  };
}

/** Fetch 2FA statistics from /verify/statistics */
export function useTwoFAStatistics(channel: TwoFAChannel, groups: string[], startDate: string, endDate: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['twofa-statistics', { accountId, channel, groups, startDate, endDate }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawTwoFAStatistic[]>('/verify/statistics', {
        params: {
          startDate,
          endDate,
          method: toVerifyMethod(channel),
          group: groups,
        },
        signal,
      });
      return (data ?? []).map(normalizeStat);
    },
    enabled: auth.status === 'authenticated' && groups.length > 0,
    staleTime: 30_000,
  });
}

/** Fetch all 2FA messages for a channel (for dropdown selectors) */
export function useTwoFAMessageOptions(channel: TwoFAChannel) {
  return useTwoFAMessagesList({ page: 1, pageSize: 100, search: '', sort: '', order: 'asc' as const }, channel);
}

/** Fetch per-message delivery statistics (delivered, open, bounce, etc.) */
export function useTwoFAMessageStatistics(
  messageIds: number[],
  channel: TwoFAChannel,
  startDate: string,
  endDate: string,
) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['twofa-message-stats', { accountId, messageIds, channel, startDate, endDate }],
    queryFn: async ({ signal }) => {
      const endpoint = channel === 'email' ? '/statistics/email' : `/statistics/${channel}`;
      const { data } = await apiClient.get<Record<string, { general: Record<string, number> }>>(endpoint, {
        params: {
          startDate,
          endDate,
          groupByMessage: true,
          messages: messageIds,
        },
        paramsSerializer: { indexes: null },
        signal,
      });
      return data ?? {};
    },
    enabled: auth.status === 'authenticated' && messageIds.length > 0,
    staleTime: 60_000,
  });
}
