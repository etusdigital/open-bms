import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { Template } from './types';
import type { TemplateFormValues } from './template-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchTemplatesList(
  params: ListSearchParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Template>> {
  const { data } = await apiClient.get<RawPaginatedResponse<Template>>('/email-template', {
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

export function useTemplatesList(params: ListSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.templates.list(accountId, params),
    queryFn: ({ signal }) => fetchTemplatesList(params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useTemplate(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.templates.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<Template>(`/email-template/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      const { data: result } = await apiClient.post<Template>('/email-template', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('templates.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.createError', { entity: i18n.t('templates.entityName') }),
      );
    },
  });
}

export function useUpdateTemplate(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      const { data: result } = await apiClient.put<Template>(`/email-template/${id}`, data);
      return result;
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: [...queryKeys.templates.all, 'detail'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('templates.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.updateError', { entity: i18n.t('templates.entityName') }),
      );
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/email-template/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('templates.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('templates.entityName') }),
      );
    },
  });
}

export function useDuplicateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<Template>(`/email-template/${id}/copy`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
      toast.success(i18n.t('templates.duplicateSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('templates.duplicateError'));
    },
  });
}
