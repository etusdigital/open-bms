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

// Default page size for the contact-history infinite query. 100 because the
// I/O cost per CH page is dominated by the granule scan (see PDBR-202), so
// fetching 10 vs 100 rows that match the WHERE has near-identical cost.
// Larger pages mean fewer round-trips on contacts with rich timelines.
// Mirror of `ContactsService.DEFAULT_HISTORY_ITEMS_PER_PAGE` in msgops-api;
// the API also defaults to 100 when no `itemsPerPage` is sent.
export const CONTACT_HISTORY_PAGE_SIZE = 100;

interface HistoryPage {
  results: HistoryItem[];
  /**
   * Server-side signal that another page exists. Computed in msgops-api
   * via the LIMIT N+1 trick on the unified CH query (PR #197). Replaces
   * the older `length === itemsPerPage` heuristic which broke whenever
   * multiple row types contributed to the same page. Optional for
   * backward compat with any older response that lacks the field.
   */
  hasMore?: boolean;
}

export function useContactHistory(contactId: number, filters?: HistoryFilters) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useInfiniteQuery({
    queryKey: queryKeys.contacts.history(accountId, contactId, filters),
    queryFn: async ({ pageParam = 1, signal }): Promise<HistoryPage> => {
      const { data } = await apiClient.get<HistoryPage>(`/contacts/history/${contactId}`, {
        params: {
          page: pageParam,
          itemsPerPage: CONTACT_HISTORY_PAGE_SIZE,
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
      return { results: data.results ?? [], hasMore: data.hasMore };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      // Prefer the server's authoritative hasMore signal. Fall back to the
      // legacy heuristic (length === pageSize) when the response predates
      // the hasMore field — keeps deployments where API and frontend are
      // out of sync from breaking pagination.
      if (typeof lastPage.hasMore === 'boolean') {
        return lastPage.hasMore ? lastPageParam + 1 : undefined;
      }
      return lastPage.results.length === CONTACT_HISTORY_PAGE_SIZE ? lastPageParam + 1 : undefined;
    },
    staleTime: 60_000,
    enabled: auth.status === 'authenticated' && contactId > 0,
  });
}
