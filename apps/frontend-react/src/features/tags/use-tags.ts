import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { Tag } from './types';
import type { TagFormValues } from './tag-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchTagsList(params: ListSearchParams, signal?: AbortSignal): Promise<PaginatedResponse<Tag>> {
  const { data } = await apiClient.get<RawPaginatedResponse<Tag>>('/tags', {
    params: {
      page: params.page,
      itemsPerPage: params.pageSize,
      ...(params.search && { title: params.search }),
      ...(params.sort && { sort: params.sort, order: params.order }),
      type: 'tag',
      withCount: true,
    },
    signal,
  });
  return toPaginatedResponse(data);
}

export function useTagsList(params: ListSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.tags.list(accountId, params),
    queryFn: ({ signal }) => fetchTagsList(params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useTag(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.tags.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<Tag>(`/tags/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TagFormValues) => {
      const { data: result } = await apiClient.post<Tag>('/tags', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('tags.entityName') }));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('common.createError', { entity: i18n.t('tags.entityName') }));
    },
  });
}

export function useUpdateTag(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TagFormValues) => {
      const { data: result } = await apiClient.put<Tag>(`/tags/${id}`, data);
      return result;
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: [...queryKeys.tags.all, 'detail'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('tags.entityName') }));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('common.updateError', { entity: i18n.t('tags.entityName') }));
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('tags.entityName') }));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('tags.entityName') }));
    },
  });
}
