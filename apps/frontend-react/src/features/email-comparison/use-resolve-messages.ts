import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { RawPaginatedResponse } from '@/types';

export interface ResolvedMessage {
  id: number;
  title: string;
  subject?: string;
  content?: string;
  content_json?: string;
  previewText?: string;
  fromName?: string;
  fromMail?: string;
  type?: string;
  url?: string;
  image?: string;
}

export function useResolveMessages(ids: number[]) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['resolve-messages', { ids }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<ResolvedMessage>>('/messages', {
        params: { messagesIds: ids, itemsPerPage: ids.length, page: 1 },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated' && ids.length > 0,
  });
}
