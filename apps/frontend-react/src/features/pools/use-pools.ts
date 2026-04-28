import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { Pool, SendGridPool, SendGridIp } from './types';
import type { PoolFormValues } from './pool-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchPoolsList(params: ListSearchParams, signal?: AbortSignal): Promise<PaginatedResponse<Pool>> {
  const { data } = await apiClient.get<RawPaginatedResponse<Pool>>('/pools', {
    params: {
      page: params.page,
      itemsPerPage: params.pageSize,
      ...(params.search && { name: params.search }),
      ...(params.sort && { sort: params.sort, order: params.order }),
    },
    signal,
  });
  return toPaginatedResponse(data);
}

export function usePoolsList(params: ListSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.pools.list(accountId, params),
    queryFn: ({ signal }) => fetchPoolsList(params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function usePool(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.pools.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<Pool>(`/pools/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useSendGridPools() {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['pools', 'sendgrid'],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<SendGridPool[]>('/pools/sendgrid', { signal });
      return data;
    },
    enabled: auth.status === 'authenticated',
  });
}

export function useSendGridIps(poolName: string) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['pools', 'sendgrid-ips', poolName],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<SendGridIp[]>(`/pools/ips/sendgrid/${poolName}`, {
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated' && poolName.length > 0,
  });
}

export function useCreatePool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PoolFormValues) => {
      const { data: result } = await apiClient.post<Pool>('/pools', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pools.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('pools.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.createError', { entity: i18n.t('pools.entityName') }),
      );
    },
  });
}

export function useUpdatePool(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PoolFormValues) => {
      const { data: result } = await apiClient.put<Pool>(`/pools/${id}`, data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pools.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('pools.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.updateError', { entity: i18n.t('pools.entityName') }),
      );
    },
  });
}

export function useDeletePool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/pools/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pools.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('pools.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('pools.entityName') }),
      );
    },
  });
}
