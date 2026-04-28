import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { InsightsApiResponse, InsightsPeriod } from './types';

export function useInsights(period: InsightsPeriod) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['insights', { accountId, period }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<InsightsApiResponse>(`/statistics/insights/${period}`, {
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated',
  });
}
