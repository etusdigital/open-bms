import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { SuppressedContact } from './types';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

export type SuppressionType = 'unsubscribed' | 'blocked';

async function fetchSuppressedList(
  type: SuppressionType,
  params: ListSearchParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<SuppressedContact>> {
  const { data } = await apiClient.get<RawPaginatedResponse<SuppressedContact>>('/contacts/suppressed', {
    params: {
      type,
      page: params.page,
      itemsPerPage: params.pageSize,
      ...(params.search && { title: params.search }),
      ...(params.sort && { sort: params.sort, order: params.order }),
    },
    signal,
  });
  return toPaginatedResponse(data);
}

export function useSuppressedList(type: SuppressionType, params: ListSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['contacts', 'suppressed', type, { accountId, ...params }],
    queryFn: ({ signal }) => fetchSuppressedList(type, params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

interface BulkSuppressPayload {
  emails: string[];
  block: boolean;
}

export function useBulkSuppress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BulkSuppressPayload) => {
      const { data } = await apiClient.post('/contacts/bulk-unsubscribe', {
        emails: payload.emails,
        allAccounts: true,
        block: payload.block,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'suppressed'] });
      toast.success(i18n.t('contacts.suppressionSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('contacts.suppressionError'));
    },
  });
}

export function useBulkResubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BulkSuppressPayload) => {
      const { data } = await apiClient.post('/contacts/bulk-resubscribe', {
        emails: payload.emails,
        block: payload.block,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'suppressed'] });
      toast.success(i18n.t('contacts.resubscribeSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('contacts.resubscribeError'));
    },
  });
}
