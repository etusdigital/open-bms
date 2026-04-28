import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';

export interface SegmentOption {
  id: number;
  name: string;
}

export function useSegmentsByAccount(accountId: number) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['tags', 'segments-by-account', accountId],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<SegmentOption[]>('/tags', {
        params: { type: 'segment', accountId },
        headers: { 'Account-Id': accountId },
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated' && accountId > 0,
  });
}
