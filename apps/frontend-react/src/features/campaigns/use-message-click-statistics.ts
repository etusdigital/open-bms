import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import type { ClickStatEntry } from './types';

/** Message shape returned by the click-statistics endpoint — full message with an added clickStats array. */
export interface MessageWithClickStats {
  id: number;
  title?: string;
  content?: string;
  clickStats: ClickStatEntry[];
  [key: string]: unknown;
}

/**
 * Fetches per-link click statistics for a message scoped to a campaign or automation.
 * Returns the message object with an added `clickStats` array where each entry has a 0-based
 * index key matching the order of `<a>` tags in the email HTML (excluding unsubscribe links).
 *
 * Disabled when any param is missing — used conditionally in preview dialogs.
 */
export function useMessageClickStatistics(
  messageId: number | undefined,
  filterId: number | undefined,
  filterType: 'campaign' | 'automation' | undefined,
) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey:
      messageId && filterId && filterType
        ? queryKeys.messages.clickStatistics(messageId, filterId, filterType)
        : ['messages', 'click-statistics', 'disabled'],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<MessageWithClickStats>(`/messages/${messageId}/click-statistics`, {
        params: { filterId, filterType },
        signal,
      });
      return data;
    },
    enabled: auth.status === 'authenticated' && Boolean(messageId) && Boolean(filterId) && Boolean(filterType),
  });
}
