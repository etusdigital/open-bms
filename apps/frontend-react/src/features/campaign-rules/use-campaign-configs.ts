import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { CampaignConfig } from './types';
import type { CampaignConfigFormValues } from './campaign-rule-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchConfigsList(
  params: ListSearchParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<CampaignConfig>> {
  const { data } = await apiClient.get<RawPaginatedResponse<CampaignConfig>>('/campaigns-rules/configs', {
    params: {
      page: params.page,
      itemsPerPage: params.pageSize,
      ...(params.search && { name: params.search }),
      ...(params.sort && { sortBy: params.sort, order: params.order }),
    },
    signal,
  });
  return toPaginatedResponse(data);
}

export function useCampaignConfigsList(params: ListSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.campaignConfigs.list(accountId, params),
    queryFn: ({ signal }) => fetchConfigsList(params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useCampaignConfig(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.campaignConfigs.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<CampaignConfig>(`/campaigns-rules/configs/${id}`, {
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateCampaignConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CampaignConfigFormValues) => {
      const { data: result } = await apiClient.post<CampaignConfig>('/campaigns-rules/configs', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignConfigs.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('campaignRules.configEntityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ??
          i18n.t('common.createError', { entity: i18n.t('campaignRules.configEntityName') }),
      );
    },
  });
}

export function useUpdateCampaignConfig(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CampaignConfigFormValues) => {
      const { data: result } = await apiClient.put<CampaignConfig>(`/campaigns-rules/configs/${id}`, data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignConfigs.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('campaignRules.configEntityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ??
          i18n.t('common.updateError', { entity: i18n.t('campaignRules.configEntityName') }),
      );
    },
  });
}

export function useDeleteCampaignConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/campaigns-rules/configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignConfigs.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('campaignRules.configEntityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ??
          i18n.t('common.deleteError', { entity: i18n.t('campaignRules.configEntityName') }),
      );
    },
  });
}

export function useDuplicateCampaignConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<CampaignConfig>(`/campaigns-rules/configs/${id}/copy`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignConfigs.all });
      toast.success(i18n.t('campaignRules.duplicateSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('campaignRules.duplicateError'));
    },
  });
}

export function useConfigsForSelect() {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['campaign-configs', 'select-all'],
    queryFn: async ({ signal }) => {
      const resp = await apiClient.get('/campaigns-rules/configs', {
        params: { page: 1, itemsPerPage: 100 },
        signal,
      });
      const raw = resp.data as any;
      const results: any[] = raw?.results ?? raw?.data ?? [];
      return results.map((config: any) => ({
        value: String(config.id),
        label: config.name,
      }));
    },
    enabled: auth.status === 'authenticated',
  });
}
