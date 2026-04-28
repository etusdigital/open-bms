import { useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import {
  formatRate,
  type Campaign,
  type CampaignWithStats,
  type CampaignRedisStatistics,
  type TestAbMessageStats,
  type DashboardGeneralStats,
  type CampaignMessageType,
  type BatchCampaignStats,
} from './types';
import type { CampaignsSearchParams } from './campaigns-search-schema';
import { parseCsvIds, parseCsvStrings } from './campaigns-search-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchCampaignsList(
  params: CampaignsSearchParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Campaign>> {
  const { data } = await apiClient.get<RawPaginatedResponse<Campaign>>('/campaigns', {
    params: {
      page: params.page,
      itemsPerPage: params.pageSize,
      isTrigger: false,
      ...(params.search && { title: params.search }),
      ...(params.sort && { sortBy: params.sort, order: params.order }),
      ...(params.status && { status: parseCsvIds(params.status) }),
      ...(params.types && { types: parseCsvStrings(params.types) }),
      ...(params.messages && { messages: parseCsvStrings(params.messages) }),
      ...(params.tags && { tags: parseCsvIds(params.tags) }),
      ...(params.segments && { segments: parseCsvIds(params.segments) }),
      ...(params.startDate && { startDate: params.startDate }),
      ...(params.endDate && { endDate: params.endDate }),
    },
    signal,
  });
  return toPaginatedResponse(data);
}

export function useCampaignsList(params: CampaignsSearchParams, refetchInterval?: number | false) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.campaigns.list(accountId, params),
    queryFn: ({ signal }) => fetchCampaignsList(params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
    refetchInterval: refetchInterval || false,
  });
}

export function useCampaign(id: number, refetchInterval?: number | false) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.campaigns.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<Campaign>(`/campaigns/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
    refetchInterval: refetchInterval ?? false,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Campaign>) => {
      const { data: result } = await apiClient.post<Campaign>('/campaigns', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('campaigns.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.createError', { entity: i18n.t('campaigns.entityName') }),
      );
    },
  });
}

export function useUpdateCampaign(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Campaign>) => {
      const { data: result } = await apiClient.put<Campaign>('/campaigns', {
        ...data,
        id,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('campaigns.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.updateError', { entity: i18n.t('campaigns.entityName') }),
      );
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('campaigns.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('campaigns.entityName') }),
      );
    },
  });
}

export function useDuplicateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<Campaign>(`/campaigns/duplicate/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      toast.success(i18n.t('campaigns.duplicateSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('campaigns.duplicateError'));
    },
  });
}

export function useCountContacts() {
  return useMutation({
    mutationFn: async (campaignData: Partial<Campaign>) => {
      const { data } = await apiClient.post<number>('/campaigns/count-contacts', campaignData);
      return data;
    },
  });
}

export function useValidateCampaignName(titleCreate: string, type: 'name' | 'title' = 'title', campaignId?: number) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['campaigns', 'validate-name', { titleCreate, type, campaignId }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<boolean>('/campaigns/validate-name', {
        params: {
          titleCreate,
          type,
          ...(campaignId && { id: campaignId }),
        },
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated' && titleCreate.length >= 3,
  });
}

export function useStopCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.get(`/campaigns/stop/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('common.error'));
    },
  });
}

export function useCampaignStatistics(campaignsIds: number[], isSending = false) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['campaigns', 'statistics', { campaignsIds }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<CampaignRedisStatistics[]>('/campaigns/statistics', {
        params: { campaignsIds },
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated' && campaignsIds.length > 0,
    refetchInterval: isSending ? 15000 : false,
  });
}

interface StatusCountRow {
  status: number;
  count_status: string;
}

export interface CampaignStatusCounts {
  sending: number;
  scheduled: number;
  completed: number;
}

export function useCampaignStatusCounts(params: CampaignsSearchParams) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['campaigns', 'statistics-all', params],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<StatusCountRow[]>('/campaigns/statistics-all', {
        params: {
          ...(params.search && { title: params.search }),
          ...(params.startDate && { startDate: params.startDate }),
          ...(params.endDate && { endDate: params.endDate }),
          ...(params.status && { status: parseCsvIds(params.status) }),
          ...(params.types && { types: parseCsvStrings(params.types) }),
          ...(params.messages && { messages: parseCsvStrings(params.messages) }),
          ...(params.tags && { tags: parseCsvIds(params.tags) }),
          ...(params.segments && { segments: parseCsvIds(params.segments) }),
        },
        signal,
      });
      const find = (status: number) => Number(data.find((r) => r.status === status)?.count_status ?? 0);

      return {
        sending: find(2) + find(6), // Sending + SendingTestAb
        scheduled: find(1),
        completed: find(5),
      } satisfies CampaignStatusCounts;
    },
    enabled: auth.status === 'authenticated',
  });
}

export function useCampaignDashboardStats(
  campaignId: number,
  messageType: CampaignMessageType,
  scheduleTo?: string,
  isSending = false,
) {
  const auth = useAppStore((s) => s.auth);
  const today = new Date().toISOString().slice(0, 10);

  return useQuery({
    queryKey: ['campaigns', 'dashboard-statistics', { campaignId, messageType, scheduleTo, today }],
    queryFn: async ({ signal }) => {
      const route = ['web-push', 'mobile-push'].includes(messageType) ? '/statistics/push' : '/statistics/email';
      const startDate = scheduleTo ? new Date(scheduleTo).toISOString().slice(0, 10) : today;
      const { data } = await apiClient.get<{ general: DashboardGeneralStats }>(route, {
        params: {
          startDate,
          endDate: today,
          campaigns: [campaignId],
          type: messageType,
        },

        signal,
      });
      return data?.general ?? data;
    },
    enabled: auth.status === 'authenticated' && campaignId > 0,
    refetchInterval: isSending ? 30000 : false,
  });
}

export function useCampaignStatisticsTestAB(campaignId: number, messagesIds: number[], isSendingTestAb = false) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['campaigns', 'statistics-testab', { campaignId, messagesIds }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<Record<number, TestAbMessageStats>>('/campaigns/statistics-testab', {
        params: { campaignId, messagesIds },

        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated' && campaignId > 0 && messagesIds.length > 0,
    refetchInterval: isSendingTestAb ? 15000 : false,
  });
}

export interface Trigger {
  id: number;
  name: string;
  description?: string;
}

export function useTriggers() {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['triggers'],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<Trigger[]>('/triggers', { signal });
      return data;
    },
    enabled: auth.status === 'authenticated',
  });
}

// --- Statistics for campaign list ---

function buildStatsRoute(messageType: CampaignMessageType): string {
  return ['web-push', 'mobile-push'].includes(messageType) ? '/statistics/push' : '/statistics/email';
}

/**
 * Groups campaigns by stats endpoint (email vs push-by-type), sends one
 * batch request per group with `groupByCampaign: true`, and distributes
 * the keyed response back into a Map<campaignId, stats>.
 */
export function useCampaignListStats(campaigns: Campaign[]): Map<number, Omit<CampaignWithStats, keyof Campaign>> {
  const auth = useAppStore((s) => s.auth);
  const today = new Date().toISOString().slice(0, 10);

  // Group campaigns by their stats route + messageType (push needs per-type grouping)
  const groups = useMemo(() => {
    const map = new Map<string, Campaign[]>();
    for (const c of campaigns) {
      if (!c.id) continue;
      const route = buildStatsRoute(c.messageType);
      // Push campaigns need separate requests per type (web-push vs mobile-push)
      const key = route === '/statistics/push' ? `${route}:${c.messageType}` : route;
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    }
    return map;
  }, [campaigns]);

  // Stable query key derived from sorted campaign IDs per group
  const groupEntries = useMemo(
    () =>
      [...groups.entries()].map(([key, camps]) => ({
        key,
        route: key.split(':')[0],
        messageType: camps[0]?.messageType,
        ids: camps.map((c) => c.id).sort((a, b) => a - b),
        minStartDate: camps.reduce((min, c) => {
          const d = c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : today;
          return d < min ? d : min;
        }, today),
      })),
    [groups, today],
  );

  return useQueries({
    queries: groupEntries.map((g) => ({
      queryKey: ['campaigns', 'list-stats-batch', { ids: g.ids, route: g.key, today }],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const { data } = await apiClient.get<BatchCampaignStats>(g.route, {
          params: {
            startDate: g.minStartDate,
            endDate: today,
            campaigns: g.ids,
            type: g.messageType,
            groupByCampaign: true,
          },
          signal,
        });
        return data;
      },
      staleTime: 5 * 60_000,
      enabled: auth.status === 'authenticated' && g.ids.length > 0,
    })),
    combine: (results) => {
      const map = new Map<number, Omit<CampaignWithStats, keyof Campaign>>();
      for (const result of results) {
        if (!result.data) continue;
        const batchData = result.data as BatchCampaignStats;
        for (const [idStr, entry] of Object.entries(batchData)) {
          const campaignId = Number(idStr);
          const general = entry?.general;
          if (!general) continue;
          const campaign = campaigns.find((c) => c.id === campaignId);
          const sentContacts = campaign?.sentContacts ?? 0;
          const delivered = general.delivered ?? 0;
          const open = general.open ?? 0;
          const click = general.click ?? 0;

          map.set(campaignId, {
            deliveredRate: formatRate(delivered, sentContacts),
            openRate: formatRate(open, delivered),
            ctr: formatRate(click, delivered),
            ctor: formatRate(click, open),
            unsubscribeCount: general.unsubscribe ?? 0,
            bounceCount: general.bounce ?? 0,
          });
        }
      }
      return map;
    },
  });
}
