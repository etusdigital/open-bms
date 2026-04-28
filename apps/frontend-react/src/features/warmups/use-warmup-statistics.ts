import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { Warmup, WarmupStatisticsResponse } from './types';

export function useWarmupStatistics(warmup: Warmup | undefined) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: [
      'warmups',
      'statistics',
      {
        accountId,
        warmupId: warmup?.id,
        targetAccountId: warmup?.targetAccountId,
        createdAt: warmup?.createdAt,
      },
    ],
    queryFn: async ({ signal }) => {
      const startDate = warmup!.createdAt!.slice(0, 10);
      const endDate = new Date().toISOString().slice(0, 10);

      const { data } = await apiClient.get<WarmupStatisticsResponse>('/statistics/email', {
        params: {
          startDate,
          endDate,
          campaigns: [warmup!.campaignId],
          type: 'email',
        },
        headers: { 'Account-Id': warmup!.targetAccountId },
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated' && !!warmup?.campaignId && !!warmup?.createdAt,
  });
}
