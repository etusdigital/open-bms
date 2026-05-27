import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

interface TagOption {
  id: number;
  name: string;
  type: 'tag' | 'segment';
}

interface TagsResponse {
  results: TagOption[];
}

export function useTagOptions(enabled = true, search = '') {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: [...queryKeys.tags.all, 'options', { type: 'tag', search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<TagsResponse>('/tags', {
        params: {
          type: 'tag',
          itemsPerPage: 40,
          ...(search && { title: search }),
        },
        signal,
      });
      return (data.results ?? []).map((t) => ({
        value: String(t.id),
        label: t.name,
      }));
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    enabled: enabled && auth.status === 'authenticated',
  });
}

export function useSegmentOptions(enabled = true, search = '') {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: [...queryKeys.tags.all, 'options', { type: 'segment', search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<TagsResponse>('/tags', {
        params: {
          type: 'segment',
          itemsPerPage: 40,
          ...(search && { title: search }),
        },
        signal,
      });
      return (data.results ?? []).map((t) => ({
        value: String(t.id),
        label: t.name,
      }));
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    enabled: enabled && auth.status === 'authenticated',
  });
}

export function useBulkAddTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { contactIds: number[]; tagIds: number[] }) => {
      const { data } = await apiClient.post('/contacts/tags', {
        contacts: params.contactIds,
        tags: params.tagIds,
        action: 'add',
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success(i18n.t('contacts.bulkTagsAdded'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('contacts.bulkTagsError'));
    },
  });
}

export function useBulkRemoveTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { contactIds: number[]; tagIds: number[] }) => {
      const { data } = await apiClient.post('/contacts/tags', {
        contacts: params.contactIds,
        tags: params.tagIds,
        action: 'remove',
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success(i18n.t('contacts.bulkTagsRemoved'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('contacts.bulkTagsError'));
    },
  });
}

export function useBulkUnsubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { emails: string[] }) => {
      const { data } = await apiClient.post('/contacts/bulk-unsubscribe', {
        emails: params.emails,
        allAccounts: true,
        block: false,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success(i18n.t('contacts.bulkUnsubscribeSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('contacts.bulkUnsubscribeError'));
    },
  });
}
