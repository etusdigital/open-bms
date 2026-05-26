import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface ActivityEvent {
  time: string;
  time_date: string;
  account_id: number;
  message_type: string;
  event: string;
  contact_id: number;
  automation_id: number;
  campaign_id: number;
  message_id: number;
  email: string;
  provider: string;
  provider_account: string;
  uuid: string;
  url: string;
  reason: string;
  ip: string;
  user_agent: string;
  country: string;
  region: string;
  city: string;
  properties: unknown;
  events_logs_id: string;
  [key: string]: unknown;
}

export interface ActivityPage {
  events: ActivityEvent[];
  nextCursor: string | null;
  appliedRange: { after: string; before: string };
}

export function useActivityEvents(q: string) {
  return useInfiniteQuery({
    queryKey: ['activity', q],
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await apiClient.get<ActivityPage>('/admin/activity/events', {
        params: { q: q || undefined, cursor: pageParam || undefined, limit: 50 },
        signal,
      });
      return data;
    },
    initialPageParam: '' as string,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}
