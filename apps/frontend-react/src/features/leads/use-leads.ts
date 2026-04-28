import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { LeadRow } from './types';

interface UseLeadsParams {
  groupItems: string[];
  startDate: string;
  endDate: string;
  search: string[]; // format: ["field:value", "field:value"]
}

export function useLeads(params: UseLeadsParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['leads', { accountId, ...params }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<LeadRow[]>('/statistics/leads', {
        params: {
          startDate: params.startDate,
          endDate: params.endDate,
          groupItems: params.groupItems,
          ...(params.search.length > 0 && { search: params.search }),
        },
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated' && params.groupItems.length > 0,
  });
}
