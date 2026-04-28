import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { Label } from './types';
import type { LabelFormValues } from './label-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchLabelsList(params: ListSearchParams, signal?: AbortSignal): Promise<PaginatedResponse<Label>> {
  const { data } = await apiClient.get<RawPaginatedResponse<Label>>('/labels', {
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

export function useLabelsList(params: ListSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.labels.list(accountId, params),
    queryFn: ({ signal }) => fetchLabelsList(params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useLabel(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.labels.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<Label>(`/labels/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LabelFormValues) => {
      const { data: result } = await apiClient.post<Label>('/labels', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('labels.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.createError', { entity: i18n.t('labels.entityName') }),
      );
    },
  });
}

export function useUpdateLabel(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LabelFormValues) => {
      const { data: result } = await apiClient.put<Label>(`/labels/${id}`, data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('labels.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.updateError', { entity: i18n.t('labels.entityName') }),
      );
    },
  });
}

export function useDeleteLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/labels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('labels.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('labels.entityName') }),
      );
    },
  });
}
