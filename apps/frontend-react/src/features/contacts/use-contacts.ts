import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import { mapContact, mapContacts } from './contact-mapper';
import { parseCsvIds, type ContactsSearchParams } from './contacts-search-schema';
import type { Contact, ContactDashboard, ImportPayload } from './types';
import type { ContactEditValues } from './contact-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchContactsList(
  params: ContactsSearchParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Contact>> {
  const { data } = await apiClient.get<RawPaginatedResponse<any>>('/contacts', {
    params: {
      page: params.page,
      itemsPerPage: params.pageSize,
      ...(params.search && { title: params.search }),
      ...(params.sort && { sort: params.sort, order: params.order }),
      ...(params.tags && { tags: parseCsvIds(params.tags) }),
      ...(params.segments && { segments: parseCsvIds(params.segments) }),
      ...(params.status === 'active' && { isActive: true }),
      ...(params.status === 'unsubscribed' && { isUnsubscribed: true }),
      ...(params.status === 'bounced' && { hasBounced: true }),
      ...(params.status === 'blocked' && { isBlocked: true }),
      ...(params.startDate && { startDate: params.startDate }),
      ...(params.endDate && { endDate: params.endDate }),
    },
    signal,
  });
  return {
    data: mapContacts(data.results),
    meta: {
      total: Number(data.totalItems),
      page: Number(data.page),
      pageSize: Number(data.itemsPerPage),
    },
  };
}

export function useContactsList(params: ContactsSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.contacts.list(accountId, params),
    queryFn: ({ signal }) => fetchContactsList(params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useContact(uuid: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: [...queryKeys.contacts.all, 'detail', { accountId, uuid }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get(`/contacts/${uuid}`, { signal });
      return mapContact(data);
    },
    enabled: auth.status === 'authenticated' && !!uuid,
  });
}

export function useContactDashboard() {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.contacts.dashboard(accountId),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<ContactDashboard>('/contacts/dashboard', { signal });
      return data;
    },
    enabled: auth.status === 'authenticated',
  });
}

export function useUpdateContact(uuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ContactEditValues) => {
      const { data: result } = await apiClient.put<Contact>('/contact', {
        ...data,
        uuid,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: [...queryKeys.contacts.all, 'detail'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('contacts.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.updateError', { entity: i18n.t('contacts.entityName') }),
      );
    },
  });
}

export function useImportContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ImportPayload) => {
      const { data } = await apiClient.post('/contacts/import', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success(i18n.t('contacts.importSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('contacts.importError'));
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('contacts.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ?? i18n.t('common.deleteError', { entity: i18n.t('contacts.entityName') }),
      );
    },
  });
}
