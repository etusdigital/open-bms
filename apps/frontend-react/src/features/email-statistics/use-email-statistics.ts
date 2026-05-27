import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { StatisticsResponse, MessageType } from './types';
import { parseCsvIds } from './statistics-search-schema';
import type { StatisticsSearchParams } from './statistics-search-schema';

function buildApiParams(searchParams: StatisticsSearchParams): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  if (searchParams.startDate) params.startDate = searchParams.startDate;
  if (searchParams.endDate) params.endDate = searchParams.endDate;

  const arrayFields = ['campaigns', 'automations', 'messages', 'tags', 'segments', 'senders', 'subUsers'] as const;
  for (const field of arrayFields) {
    const csv = searchParams[field];
    if (csv) {
      params[field] = parseCsvIds(csv);
    }
  }

  return params;
}

export function useEmailStatistics(searchParams: StatisticsSearchParams, messageType: MessageType) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  const { startDate, endDate, campaigns, automations, messages, tags, segments, senders, subUsers } = searchParams;

  return useQuery({
    queryKey: [
      'statistics',
      messageType,
      {
        accountId,
        startDate,
        endDate,
        campaigns,
        automations,
        messages,
        tags,
        segments,
        senders,
        subUsers,
      },
    ],
    queryFn: async ({ signal }) => {
      const endpoint = messageType === 'email' ? '/statistics/email' : '/statistics/push';
      const params = buildApiParams({
        startDate,
        endDate,
        campaigns,
        automations,
        messages,
        tags,
        segments,
        senders,
        subUsers,
      });
      const { data } = await apiClient.get<StatisticsResponse>(endpoint, {
        params,
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated' && !!startDate && !!endDate,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
