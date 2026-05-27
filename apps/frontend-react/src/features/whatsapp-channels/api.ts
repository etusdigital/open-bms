import { apiClient } from '@/lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export type WhatsappChannelMode = 'meta' | 'evohub';
export type WhatsappChannelStatus = 'pending' | 'active' | 'disconnected' | 'error';

export interface WhatsappChannelSummary {
  id: number;
  name: string;
  mode: WhatsappChannelMode;
  status: WhatsappChannelStatus;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  wabaId: string | null;
  /** Only on POST response for EvoHub channels (`mode='evohub'`) — open in new tab to finish signup. */
  publicLink?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMetaChannelPayload {
  name: string;
  mode: 'meta';
  code: string;
  phone_number_id: string;
  waba_id: string;
  business_id?: string;
}

export interface CreateEvoHubChannelPayload {
  name: string;
  mode: 'evohub';
}

export type CreateChannelPayload = CreateMetaChannelPayload | CreateEvoHubChannelPayload;

export interface HubChannelOption {
  id: string;
  name?: string;
  status: string;
  wabaName?: string;
  displayPhoneNumber?: string;
  phoneNumberId?: string;
  wabaId?: string;
  alreadyAttached: boolean;
}

export const whatsappChannelsService = {
  async list(accountId: number): Promise<WhatsappChannelSummary[]> {
    const { data } = await apiClient.get<WhatsappChannelSummary[]>(`/accounts/${accountId}/whatsapp-channels`);
    return data;
  },
  async get(accountId: number, channelId: number): Promise<WhatsappChannelSummary> {
    const { data } = await apiClient.get<WhatsappChannelSummary>(`/accounts/${accountId}/whatsapp-channels/${channelId}`);
    return data;
  },
  async create(accountId: number, payload: CreateChannelPayload): Promise<WhatsappChannelSummary> {
    const { data } = await apiClient.post<WhatsappChannelSummary>(`/accounts/${accountId}/whatsapp-channels`, payload);
    return data;
  },
  async listHubChannels(accountId: number): Promise<HubChannelOption[]> {
    const { data } = await apiClient.get<HubChannelOption[]>(`/accounts/${accountId}/whatsapp-channels/hub-channels/available`);
    return data;
  },
  async attachExisting(accountId: number, payload: { hubChannelId: string; name?: string }): Promise<WhatsappChannelSummary> {
    const { data } = await apiClient.post<WhatsappChannelSummary>(`/accounts/${accountId}/whatsapp-channels/attach-existing`, payload);
    return data;
  },
  async delete(accountId: number, channelId: number): Promise<void> {
    await apiClient.delete(`/accounts/${accountId}/whatsapp-channels/${channelId}`);
  },
};

export function useWhatsappChannels(accountId: number | null) {
  return useQuery({
    queryKey: queryKeys.whatsappChannels.list(accountId ?? 0),
    queryFn: () => whatsappChannelsService.list(accountId!),
    enabled: accountId != null,
  });
}

/**
 * Polls a single channel every 5s while it stays in `pending` — used while the
 * admin completes Embedded Signup in the EvoHub-hosted tab and we wait for the
 * `channel_connected` webhook to flip status to `active`.
 */
export function useChannelStatusPolling(accountId: number | null, channelId: number | null) {
  return useQuery({
    queryKey: queryKeys.whatsappChannels.detail(accountId ?? 0, channelId ?? 0),
    queryFn: () => whatsappChannelsService.get(accountId!, channelId!),
    enabled: accountId != null && channelId != null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' ? 5000 : false;
    },
  });
}

export function useDeleteWhatsappChannel(accountId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channelId: number) => whatsappChannelsService.delete(accountId!, channelId),
    onSuccess: () => {
      if (accountId != null) {
        queryClient.invalidateQueries({ queryKey: queryKeys.whatsappChannels.list(accountId) });
      }
    },
  });
}
