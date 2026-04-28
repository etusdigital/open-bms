import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { CustomEvent } from './types';
import type { CustomEventFormValues } from './custom-event-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchCustomEventsList(
  params: ListSearchParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<CustomEvent>> {
  const { data } = await apiClient.get<RawPaginatedResponse<CustomEvent>>('/custom-events', {
    params: {
      page: params.page,
      itemsPerPage: params.pageSize,
      ...(params.search && { title: params.search }),
      ...(params.sort && { sort: params.sort, order: params.order }),
    },
    signal,
  });
  return toPaginatedResponse(data);
}

export function useCustomEventsList(params: ListSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.customEvents.list(accountId, params),
    queryFn: ({ signal }) => fetchCustomEventsList(params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useCustomEvent(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.customEvents.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<CustomEvent>(`/custom-events/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateCustomEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CustomEventFormValues) => {
      const { data: result } = await apiClient.post<CustomEvent>('/custom-events', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customEvents.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('customEvents.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.createError', { entity: i18n.t('customEvents.entityName') }),
      );
    },
  });
}

export function useUpdateCustomEvent(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CustomEventFormValues) => {
      const { data: result } = await apiClient.put<CustomEvent>(`/custom-events/${id}`, data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customEvents.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('customEvents.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.updateError', { entity: i18n.t('customEvents.entityName') }),
      );
    },
  });
}

export function useDeleteCustomEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/custom-events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customEvents.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('customEvents.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('customEvents.entityName') }),
      );
    },
  });
}
