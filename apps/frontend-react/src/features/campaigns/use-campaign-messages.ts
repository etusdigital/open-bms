import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { RawPaginatedResponse } from '@/types';
import type { Message } from '@/features/messages/types';
import type { CampaignMessageType } from './types';

export type SearchableMessage = Message;

interface SearchMessagesParams {
  title: string;
  messageType: CampaignMessageType;
}

export function useSearchMessages({ title, messageType }: SearchMessagesParams) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['messages', 'search', { title, messageType }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<Message>>('/messages', {
        params: {
          title: title || undefined,
          type: messageType,
          page: 1,
          itemsPerPage: 40,
          ...(messageType === 'whatsapp' && { status: 'approved' }),
        },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated' && title.length > 0,
  });
}
