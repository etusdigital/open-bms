import { QueryClient, QueryCache } from '@tanstack/react-query';
import { AxiosError } from 'axios';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (count, error) => {
        if (error instanceof AxiosError && error.response?.status === 401) return false;
        return count < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof AxiosError && error.response?.status === 401) {
        // 401 handling is done in api-client interceptor
      }
    },
  }),
});
