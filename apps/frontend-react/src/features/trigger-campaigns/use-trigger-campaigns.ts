import { useQuery, useQueries, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import {
  formatRate,
  type Campaign,
  type CampaignWithStats,
  type DashboardGeneralStats,
  type CampaignMessageType,
} from '@/features/campaigns/types';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchTriggerCampaignsList(
  params: ListSearchParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Campaign>> {
  const { data } = await apiClient.get<RawPaginatedResponse<Campaign>>('/campaigns', {
    params: {
      page: params.page,
      itemsPerPage: params.pageSize,
      isTrigger: true,
      ...(params.search && { title: params.search }),
      ...(params.sort && { sortBy: params.sort, order: params.order }),
    },
    signal,
  });
  return toPaginatedResponse(data);
}

export function useTriggerCampaignsList(params: ListSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['trigger-campaigns', 'list', { accountId, ...params }],
    queryFn: ({ signal }) => fetchTriggerCampaignsList(params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useTriggerCampaign(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['trigger-campaigns', 'detail', { accountId, id }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<Campaign>(`/campaigns/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useDeleteTriggerCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trigger-campaigns'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('triggerCampaigns.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ??
          i18n.t('common.deleteError', { entity: i18n.t('triggerCampaigns.entityName') }),
      );
    },
  });
}

export function useCreateTriggerCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Campaign>) => {
      const { data: result } = await apiClient.post<Campaign>('/campaigns', {
        ...data,
        isTrigger: true,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trigger-campaigns'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('triggerCampaigns.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ??
          i18n.t('common.createError', { entity: i18n.t('triggerCampaigns.entityName') }),
      );
    },
  });
}

export function useUpdateTriggerCampaign(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Campaign>) => {
      const { data: result } = await apiClient.put<Campaign>('/campaigns', {
        ...data,
        id,
        isTrigger: true,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trigger-campaigns'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('triggerCampaigns.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ??
          i18n.t('common.updateError', { entity: i18n.t('triggerCampaigns.entityName') }),
      );
    },
  });
}

// --- Statistics for trigger campaign list ---

function buildStatsRoute(messageType: CampaignMessageType): string {
  return ['web-push', 'mobile-push'].includes(messageType) ? '/statistics/push' : '/statistics/email';
}

export function useTriggerCampaignListStats(
  campaigns: Campaign[],
): Map<number, Omit<CampaignWithStats, keyof Campaign>> {
  const auth = useAppStore((s) => s.auth);
  const today = new Date().toISOString().slice(0, 10);

  return useQueries({
    queries: campaigns.map((c) => ({
      queryKey: ['trigger-campaigns', 'stats', { campaignId: c.id, messageType: c.messageType, today }],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const startDate = c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : today;
        const { data } = await apiClient.get<{ general: DashboardGeneralStats }>(buildStatsRoute(c.messageType), {
          params: {
            startDate,
            endDate: today,
            campaigns: [c.id],
            type: c.messageType,
          },
          signal,
        });
        return { campaignId: c.id, general: data?.general ?? data };
      },
      staleTime: 5 * 60_000,
      enabled: auth.status === 'authenticated',
    })),
    combine: (results) => {
      const map = new Map<number, Omit<CampaignWithStats, keyof Campaign>>();
      for (const result of results) {
        if (!result.data) continue;
        const { campaignId, general } = result.data as {
          campaignId: number;
          general: DashboardGeneralStats;
        };
        const campaign = campaigns.find((c) => c.id === campaignId);
        const sentContacts = campaign?.sentContacts ?? 0;
        const delivered = general?.delivered ?? 0;
        const open = general?.open ?? 0;
        const click = general?.click ?? 0;

        map.set(campaignId, {
          deliveredRate: formatRate(delivered, sentContacts),
          openRate: formatRate(open, delivered),
          ctr: formatRate(click, delivered),
          ctor: formatRate(click, open),
          unsubscribeCount: general?.unsubscribe ?? 0,
          bounceCount: general?.bounce ?? 0,
        });
      }
      return map;
    },
  });
}

export interface CustomEvent {
  id: number;
  name: string;
  description?: string;
}

export function useCustomEvents(search: string) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['custom-events', { search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<CustomEvent[]>('/custom-events', {
        params: { title: search || undefined, page: 1, itemsPerPage: 50 },
        signal,
      });
      return Array.isArray(data) ? data : ((data as any)?.results ?? (data as any)?.data ?? []);
    },
    enabled: auth.status === 'authenticated',
  });
}
