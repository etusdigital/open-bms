import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { Message, MessageType, MessagePriority } from './types';
import type { Pool } from '@/features/pools/types';
import type { Sender } from '@/features/senders/types';
import type { Label } from '@/features/labels/types';
import type { Template } from '@/features/templates/types';
import type { Automation } from '@/features/automations/types';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

export interface MessagesListFilters {
  sender?: string;
  automationId?: number;
}

/**
 * `type` accepted by the messages list endpoint. Pass a single MessageType for per-channel
 * listings (`/messages?type=email`), or an array of strings to filter by multiple types at once
 * — e.g. `TRANSACTIONAL_TYPES` from `./types` for the transactional messages listing.
 */
export type MessagesListType = MessageType | readonly string[];

async function fetchMessagesList(
  params: ListSearchParams,
  messageType: MessagesListType,
  filters?: MessagesListFilters,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Message>> {
  const { data } = await apiClient.get<RawPaginatedResponse<Message>>('/messages', {
    params: {
      page: params.page,
      itemsPerPage: params.pageSize,
      type: messageType,
      ...(params.search && { title: params.search }),
      ...(params.sort && { sortBy: params.sort, order: params.order }),
      ...(filters?.sender && { senderEmail: filters.sender }),
      ...(filters?.automationId && { selectedAutomation: filters.automationId }),
    },
    signal,
  });
  return toPaginatedResponse(data);
}

export function useMessagesList(
  params: ListSearchParams,
  messageType: MessagesListType,
  filters?: MessagesListFilters,
) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: [...queryKeys.messages.list(accountId, params), messageType, filters],
    queryFn: ({ signal }) => fetchMessagesList(params, messageType, filters, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useMessage(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.messages.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<Message>(`/messages/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Message>) => {
      const { data: result } = await apiClient.post<Message>('/messages', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('messages.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.createError', { entity: i18n.t('messages.entityName') }),
      );
    },
  });
}

export function useUpdateMessage(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Message>) => {
      const { data: result } = await apiClient.put<Message>(`/messages/${id}`, data);
      return result;
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: [...queryKeys.messages.all, 'detail'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('messages.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.updateError', { entity: i18n.t('messages.entityName') }),
      );
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/messages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('messages.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('messages.entityName') }),
      );
    },
  });
}

export function useDuplicateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<Message>(`/messages/${id}/copy`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
      toast.success(i18n.t('messages.duplicateSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('messages.duplicateError'));
    },
  });
}

interface SyncTemplateStatusResult {
  status: 'approved' | 'rejected' | 'sent_approval';
  metaStatus: string;
  rejectedReason?: string;
}

/**
 * Force a Meta poll to refresh the template approval status — useful when the
 * Meta webhook never fired (dev tunnels, missed delivery, hub proxy mid-deploy)
 * or the operator just wants a result in seconds.
 */
export function useSyncTemplateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number): Promise<SyncTemplateStatusResult> => {
      const { data } = await apiClient.post<SyncTemplateStatusResult>(`/messages/${id}/sync-template-status`);
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
      const key = `messages.syncStatus_${result.status}` as const;
      toast.success(i18n.t(key, { meta: result.metaStatus }));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('messages.syncStatusError'));
    },
  });
}

/**
 * Pull every template that exists on Meta (WABA) into BMS. Creates missing
 * rows, refreshes status/category on existing ones, idempotent — safe to
 * click multiple times.
 */
export function useSyncTemplatesFromMeta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ created: number; updated: number; skipped: number; total: number }> => {
      const { data } = await apiClient.post<{ created: number; updated: number; skipped: number; total: number }>('/messages/whatsapp/sync-from-meta');
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
      toast.success(i18n.t('messages.syncFromMetaResult', { created: result.created, updated: result.updated, total: result.total }));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('messages.syncFromMetaError'));
    },
  });
}

export function useLabelsAll() {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: [...queryKeys.labels.all, 'select', { accountId }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<Label>>('/labels', {
        params: { itemsPerPage: 1000 },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated',
  });
}

export function usePoolsForSelect() {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: [...queryKeys.pools.all, 'select', { accountId }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<Pool>>('/pools', {
        params: { page: 1, itemsPerPage: 1000 },
        signal,
      });
      return data.results;
    },
    enabled: auth.status === 'authenticated',
  });
}

export function useSendersForSelect() {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: [...queryKeys.senders.all, 'select', { accountId }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<Sender>>('/senders', {
        params: { page: 1, itemsPerPage: 1000 },
        signal,
      });
      return data.results;
    },
    enabled: auth.status === 'authenticated',
  });
}

export function useTemplatesForSelect() {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: [...queryKeys.templates.all, 'select', { accountId }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<Template>>('/email-template', {
        params: { page: 1, itemsPerPage: 1000 },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated',
  });
}

export function useAutomationsForSelect() {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['automations', 'select', { accountId }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<Automation>>('/automations', {
        params: { page: 1, itemsPerPage: 1000, type: 'email' },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated',
    staleTime: 5 * 60 * 1000,
  });
}

export async function validateMessageName(titleCreate: string, type: MessageType, id?: number): Promise<boolean> {
  const { data } = await apiClient.get<Message[]>('/messages/validate-name', {
    params: {
      titleCreate,
      type,
      ...(id && { id }),
    },
  });
  // Empty array = name is available
  return data.length === 0;
}

export interface SendTestEmailPayload {
  contact: { email: string; firstName: string };
  message: {
    id: number;
    title: string;
    previewText: string;
    ippool: string;
    subject: string;
    replyTo: string;
    priority: MessagePriority;
    content: string;
    from: { firstName: string; email: string };
  };
  loadContactFromDatabase: boolean;
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: async (payload: SendTestEmailPayload) => {
      const { data } = await apiClient.post('/services/send-email', payload);
      return data;
    },
    onSuccess: () => {
      toast.success(i18n.t('messages.testSendSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('messages.testSendError'));
    },
  });
}

export interface SendTestMobilePushPayload {
  email: string;
  message: {
    id: number;
    title: string;
    subject: string;
    content: string;
    url: string;
    type: 'mobile-push';
    expiryPushInSeconds: string;
  };
}

export function useSendTestMobilePush() {
  return useMutation({
    mutationFn: async (payload: SendTestMobilePushPayload) => {
      const { data } = await apiClient.post('/services/send-mobile-push', payload);
      return data;
    },
    onSuccess: () => {
      toast.success(i18n.t('messages.testSendMobilePushSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('messages.testSendMobilePushError'));
    },
  });
}

export interface SendTestWhatsAppPayload {
  email: string;
  messageId: number;
}

export function useSendTestWhatsApp() {
  return useMutation({
    mutationFn: async (payload: SendTestWhatsAppPayload) => {
      const { data } = await apiClient.post('/services/send-whatsapp', payload);
      return data;
    },
    onSuccess: () => {
      toast.success(i18n.t('messages.testSendWhatsAppSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('messages.testSendWhatsAppError'));
    },
  });
}
