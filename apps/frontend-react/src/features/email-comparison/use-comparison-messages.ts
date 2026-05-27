import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { RawPaginatedResponse } from '@/types';
import type { ComparisonMessageType, SelectedMessage } from './types';

export function useComparisonMessages(messageType: ComparisonMessageType, search: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['comparison-messages', { accountId, messageType, search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<SelectedMessage>>('/messages', {
        params: {
          type: messageType,
          ...(search && { title: search }),
          page: 1,
          itemsPerPage: 50,
        },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated',
    placeholderData: (prev) => prev,
  });
}
