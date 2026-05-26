import { useQuery, keepPreviousData } from '@tanstack/react-query';
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
  page: number;
  limit: number;
  hasNext: boolean;
  appliedRange: { after: string; before: string };
}

export function useActivityEvents(q: string, page: number) {
  return useQuery({
    queryKey: ['activity', q, page],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<ActivityPage>('/admin/activity/events', {
        params: { q: q || undefined, page, limit: 50 },
        signal,
      });
      return data;
    },
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}
