import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';

export interface PoolOption {
  id: number;
  poolName: string;
  senderEmail: string;
  senderReplyTo?: string | null;
}

export function usePoolsByAccount(accountId: number) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['pools', 'by-account', accountId],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<PoolOption[]>('/pools', {
        params: { accountId },
        headers: { 'Account-Id': accountId },
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated' && accountId > 0,
  });
}
