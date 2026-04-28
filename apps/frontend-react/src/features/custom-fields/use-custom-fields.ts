import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { CustomField } from './types';
import type { CustomFieldFormValues } from './custom-field-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchCustomFieldsList(
  params: ListSearchParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<CustomField>> {
  const { data } = await apiClient.get<RawPaginatedResponse<CustomField>>('/custom-fields', {
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

export function useCustomFieldsList(params: ListSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.customFields.list(accountId, params),
    queryFn: ({ signal }) => fetchCustomFieldsList(params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useCustomFieldsAll() {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: [...queryKeys.customFields.all, 'all', accountId],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<CustomField>>('/custom-fields', {
        params: { itemsPerPage: 1000 },
        signal,
      });
      return toPaginatedResponse(data).data;
    },
    enabled: auth.status === 'authenticated',
    staleTime: 5 * 60 * 1000,
  });
}

export function useCustomField(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.customFields.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<CustomField>(`/custom-fields/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CustomFieldFormValues) => {
      const { data: result } = await apiClient.post<CustomField>('/custom-fields', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customFields.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('customFields.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.createError', { entity: i18n.t('customFields.entityName') }),
      );
    },
  });
}

export function useUpdateCustomField(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CustomFieldFormValues) => {
      const { data: result } = await apiClient.put<CustomField>(`/custom-fields/${id}`, data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customFields.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('customFields.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.updateError', { entity: i18n.t('customFields.entityName') }),
      );
    },
  });
}

export function useDeleteCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/custom-fields/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customFields.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('customFields.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('customFields.entityName') }),
      );
    },
  });
}
