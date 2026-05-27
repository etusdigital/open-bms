import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { ComparisonMessageType, ComparisonResponse } from './types';

export function useMessageComparison(
  messageType: ComparisonMessageType,
  messageIds: number[],
  startDate: string,
  endDate: string,
) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['message-comparison', { accountId, messageType, messageIds, startDate, endDate }],
    queryFn: async ({ signal }) => {
      const endpoint = messageType === 'email' ? '/statistics/email' : '/statistics/push';
      const { data } = await apiClient.get<ComparisonResponse>(endpoint, {
        params: {
          startDate,
          endDate,
          messages: messageIds,
          groupByMessage: true,
        },
        paramsSerializer: { indexes: null },
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated' && messageIds.length > 0,
  });
}
