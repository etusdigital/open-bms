import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { ProductsResponse } from './types';

export function useProducts(date: string, timezone: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['products', { accountId, date, timezone }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<ProductsResponse>('/campaigns/products', {
        params: { date, timezone },
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated' && !!date,
  });
}
