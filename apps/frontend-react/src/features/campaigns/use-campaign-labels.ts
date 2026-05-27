import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { RawPaginatedResponse } from '@/types';

interface Label {
  id: number;
  name: string;
}

const SELECT_LIMIT = 20;
const STALE_TIME = 5 * 60 * 1000;

export function useLabelsForCampaign(search?: string) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['labels', 'campaign-select', { search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<Label>>('/labels', {
        params: {
          itemsPerPage: SELECT_LIMIT,
          ...(search && { name: search }),
        },
        signal,
      });
      return (data.results ?? []).map((l) => ({ value: l.id, label: l.name }));
    },
    enabled: auth.status === 'authenticated',
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
  });
}
