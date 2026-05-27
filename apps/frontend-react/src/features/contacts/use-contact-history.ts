import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import type { HistoryItem } from './types';

interface HistoryFilters {
  activityType?: string;
  channel?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}

export function useContactHistory(contactId: number, filters?: HistoryFilters) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useInfiniteQuery({
    queryKey: queryKeys.contacts.history(accountId, contactId, filters),
    queryFn: async ({ pageParam = 1, signal }) => {
      const { data } = await apiClient.get<{ results: HistoryItem[] }>(`/contacts/history/${contactId}`, {
        params: {
          page: pageParam,
          itemsPerPage: 10,
          ...(filters?.activityType &&
            filters.activityType !== 'all' && {
              activities: filters.activityType,
            }),
          ...(filters?.channel &&
            filters.channel !== 'all' && {
              channels: filters.channel,
            }),
          ...(filters?.startDate && { startDate: filters.startDate }),
          ...(filters?.endDate && { endDate: filters.endDate }),
        },
        signal,
      });
      return data.results ?? [];
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => (lastPage.length === 10 ? lastPageParam + 1 : undefined),
    staleTime: 60_000,
    enabled: auth.status === 'authenticated' && contactId > 0,
  });
}
