import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { MessageType } from '@/features/messages/types';

interface MessageOption {
  id: number;
  title: string;
}

interface MessagesResponse {
  results: MessageOption[];
}

/**
 * Lightweight message search hook for the segment builder.
 * Fetches messages filtered by channel type with debounced search.
 * Deduplicates via TanStack Query cache (same type + search = same request).
 */
export function useBuilderMessages(channelType: string, search: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  // Map channel types to message types
  const messageType = mapChannelToMessageType(channelType);

  return useQuery({
    queryKey: ['builder-messages', accountId, messageType, search],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<MessagesResponse>('/messages', {
        params: {
          page: 1,
          type: messageType,
          itemsPerPage: 50,
          ...(search && { title: search }),
        },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated' && !!messageType,
    staleTime: 30_000,
  });
}

function mapChannelToMessageType(channelType: string): MessageType | null {
  const mapping: Record<string, MessageType> = {
    email: 'email',
    sms: 'sms',
    'web-push': 'web-push',
    'mobile-push': 'mobile-push',
    whatsapp: 'whatsapp',
  };
  return mapping[channelType] ?? null;
}
