import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { RawPaginatedResponse } from '@/types';
import type { MessageType } from './types';

interface FilterOption {
  id: number;
  title?: string;
  name?: string;
  value?: string;
  fromMail?: string;
  senderEmail?: string;
}

function useAuth() {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;
  const enabled = auth.status === 'authenticated';
  return { accountId, enabled };
}

export function useCampaignOptions(search: string, messageType: MessageType) {
  const { accountId, enabled } = useAuth();
  return useQuery({
    queryKey: ['filter-campaigns', { accountId, search, messageType }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<FilterOption>>('/campaigns', {
        params: { title: search, itemsPerPage: 20, page: 1, type: messageType },
        signal,
      });
      return (data.results ?? []).map((c) => ({ value: String(c.id), label: c.title ?? '' }));
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useAutomationOptions(search: string) {
  const { accountId, enabled } = useAuth();
  return useQuery({
    queryKey: ['filter-automations', { accountId, search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<FilterOption>>('/automations', {
        params: { title: search, itemsPerPage: 20, page: 1 },
        signal,
      });
      return (data.results ?? []).map((a) => ({ value: String(a.id), label: a.title ?? '' }));
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useMessageOptions(search: string, messageType: MessageType) {
  const { accountId, enabled } = useAuth();
  return useQuery({
    queryKey: ['filter-messages', { accountId, search, messageType }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<FilterOption>>('/messages', {
        params: { title: search, itemsPerPage: 20, page: 1, type: messageType },
        signal,
      });
      return (data.results ?? []).map((m) => ({ value: String(m.id), label: m.title ?? '' }));
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useTagOptions(search: string) {
  const { accountId, enabled } = useAuth();
  return useQuery({
    queryKey: ['filter-tags', { accountId, search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<FilterOption>>('/tags', {
        params: { title: search, itemsPerPage: 20, page: 1, type: 'tag' },
        signal,
      });
      return (data.results ?? []).map((t) => ({
        value: String(t.id),
        label: t.name ?? t.title ?? '',
      }));
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useSegmentOptions(search: string) {
  const { accountId, enabled } = useAuth();
  return useQuery({
    queryKey: ['filter-segments', { accountId, search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<FilterOption>>('/tags', {
        params: { title: search, itemsPerPage: 20, page: 1, type: 'segment' },
        signal,
      });
      return (data.results ?? []).map((s) => ({
        value: String(s.id),
        label: s.name ?? s.title ?? '',
      }));
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useSenderOptions() {
  const { accountId, enabled } = useAuth();
  return useQuery({
    queryKey: ['filter-senders', { accountId }],
    queryFn: async ({ signal }) => {
      // EVO-1281: sender identity now lives on /senders, not /pools.
      const { data } = await apiClient.get<FilterOption[]>('/senders', {
        params: { itemsPerPage: 100, page: 1 },
        signal,
      });
      const items = Array.isArray(data) ? data : ((data as RawPaginatedResponse<FilterOption>).results ?? []);
      return items.map((s) => ({
        value: String(s.id),
        label: s.senderEmail ?? s.fromMail ?? s.name ?? s.title ?? '',
      }));
    },
    enabled,
    staleTime: 60_000,
  });
}
