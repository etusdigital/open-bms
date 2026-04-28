import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { RawPaginatedResponse } from '@/types';

export interface TagOption {
  id: number;
  name: string;
  status: string;
  lastCount?: number;
  type?: string;
}

export interface TagOptionFull {
  value: string;
  label: string;
  id: number;
  name: string;
  count: number;
  type: string;
}

const SELECT_LIMIT = 200;
const STALE_TIME = 5 * 60 * 1000;

export function useTagsForAudience(search?: string) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['tags', 'audience-active', { search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<TagOption>>('/tags', {
        params: {
          status: 'active',
          itemsPerPage: SELECT_LIMIT,
          ...(search && { title: search }),
        },
        signal,
      });
      return (data.results ?? []).map(
        (tag): TagOptionFull => ({
          value: String(tag.id),
          label: `${tag.name}${tag.lastCount ? ` (${tag.lastCount.toLocaleString()})` : ''}`,
          id: tag.id,
          name: tag.name,
          count: tag.lastCount ?? 0,
          type: tag.type ?? 'tag',
        }),
      );
    },
    enabled: auth.status === 'authenticated',
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
  });
}
