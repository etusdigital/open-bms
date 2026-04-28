import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { CampaignRule } from './types';
import type { CampaignRuleFormValues } from './campaign-rule-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchRulesList(
  params: ListSearchParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<CampaignRule>> {
  const { data } = await apiClient.get<RawPaginatedResponse<CampaignRule>>('/campaigns-rules/rules', {
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

export function useCampaignRulesList(params: ListSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.campaignRules.list(accountId, params),
    queryFn: ({ signal }) => fetchRulesList(params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useCampaignRule(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.campaignRules.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<CampaignRule>(`/campaigns-rules/rules/${id}`, {
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateCampaignRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CampaignRuleFormValues) => {
      const { data: result } = await apiClient.post<CampaignRule>('/campaigns-rules/rules', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignRules.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('campaignRules.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.createError', { entity: i18n.t('campaignRules.entityName') }),
      );
    },
  });
}

export function useUpdateCampaignRule(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CampaignRuleFormValues) => {
      const { data: result } = await apiClient.put<CampaignRule>(`/campaigns-rules/rules/${id}`, data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignRules.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('campaignRules.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.updateError', { entity: i18n.t('campaignRules.entityName') }),
      );
    },
  });
}

/** Fetches all rules with their configs for the "create campaign from rule" modal */
export function useRulesForSelect() {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['campaign-rules', 'select-all'],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<any>>('/campaigns-rules/rules', {
        params: { page: 1, itemsPerPage: 100 },
        signal,
      });
      const rules = data.results ?? [];
      return rules.map((rule: any) => ({
        id: rule.id,
        name: rule.name,
        weekDays: rule.weekDays ?? [],
        configs: (rule.campaignsRulesConfigs ?? []).map((rc: any) => rc.campaignConfig),
      }));
    },
    enabled: auth.status === 'authenticated',
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeleteCampaignRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/campaigns-rules/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaignRules.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('campaignRules.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('campaignRules.entityName') }),
      );
    },
  });
}
