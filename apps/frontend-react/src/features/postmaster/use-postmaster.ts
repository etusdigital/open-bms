import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { PostmasterDomain } from './types';

export function usePostmaster(startDate: string, endDate: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['postmaster', { accountId, startDate, endDate }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<PostmasterDomain[]>('/postmaster', {
        params: { startDate, endDate },
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated',
  });
}
