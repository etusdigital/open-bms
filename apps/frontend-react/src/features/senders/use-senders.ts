import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { Sender, SyncSendersResult } from './types';
import type { SenderFormValues } from './sender-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchSendersList(
  params: ListSearchParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Sender>> {
  const { data } = await apiClient.get<RawPaginatedResponse<Sender>>('/senders', {
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

export function useSendersList(params: ListSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.senders.list(accountId, params),
    queryFn: ({ signal }) => fetchSendersList(params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useSender(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.senders.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<Sender>(`/senders/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useUpdateSender(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SenderFormValues) => {
      const { data: result } = await apiClient.put<Sender>(`/senders/${id}`, {
        sendingLimit: data.sendingLimit,
        senderReplyTo: data.senderReplyTo,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: [...queryKeys.senders.all, 'detail'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.senders.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('senders.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.updateError', { entity: i18n.t('senders.entityName') }),
      );
    },
  });
}

export function useDeleteSender() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/senders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.senders.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('senders.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('senders.entityName') }),
      );
    },
  });
}

export function useSyncSenders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<SyncSendersResult>('/senders/sync');
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.senders.all });
      toast.success(i18n.t('senders.syncResult', result));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.updateError', { entity: i18n.t('senders.entityName') }),
      );
    },
  });
}
