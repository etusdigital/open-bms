import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { Warmup } from './types';
import type { WarmupFormValues } from './warmup-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchWarmupsList(
  params: ListSearchParams,
  status?: string,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Warmup>> {
  const { data } = await apiClient.get<RawPaginatedResponse<Warmup>>('/warmups', {
    params: {
      page: params.page,
      itemsPerPage: params.pageSize,
      ...(params.search && { name: params.search }),
      ...(params.sort && { sortBy: params.sort, order: params.order?.toUpperCase() }),
      ...(status && { status }),
    },
    signal,
  });
  return toPaginatedResponse(data);
}

export function useWarmupsList(params: ListSearchParams, status?: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.warmups.list(accountId, { ...params, status } as never),
    queryFn: ({ signal }) => fetchWarmupsList(params, status, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useWarmup(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.warmups.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<Warmup>(`/warmups/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateWarmup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: WarmupFormValues) => {
      const payload = {
        ...data,
        replyTo: data.replyTo || null,
        description: data.description || null,
      };
      const { data: result } = await apiClient.post<Warmup>('/warmups', payload);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warmups.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('warmups.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.createError', { entity: i18n.t('warmups.entityName') }),
      );
    },
  });
}

export function useUpdateWarmup(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: WarmupFormValues) => {
      const payload = {
        ...data,
        replyTo: data.replyTo || null,
        description: data.description || null,
      };
      const { data: result } = await apiClient.put<Warmup>(`/warmups/${id}`, payload);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warmups.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('warmups.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.updateError', { entity: i18n.t('warmups.entityName') }),
      );
    },
  });
}

export function useDeleteWarmup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/warmups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warmups.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('warmups.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('warmups.entityName') }),
      );
    },
  });
}
