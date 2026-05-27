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

/**
 * Builds the filter query params shared by the list and count requests.
 * `page`/`itemsPerPage` are NOT included here so the same builder can feed
 * both the paginated list and the `countOnly=true` aggregate.
 */
function buildContactFilterParams(params: ContactsSearchParams) {
  return {
    ...(params.search && { title: params.search }),
    ...(params.tags && { tags: parseCsvIds(params.tags) }),
    ...(params.segments && { segments: parseCsvIds(params.segments) }),
    ...(params.status === 'active' && { isActive: true }),
    ...(params.status === 'unsubscribed' && { isUnsubscribed: true }),
    ...(params.status === 'bounced' && { hasBounced: true }),
    ...(params.status === 'blocked' && { isBlocked: true }),
    ...(params.startDate && { startDate: params.startDate }),
    ...(params.endDate && { endDate: params.endDate }),
  };
}

/** Are any of the contact filters active? Used to decide whether the total
 *  comes from the cached dashboard aggregate or from a filtered countOnly call. */
export function hasContactFilters(params: ContactsSearchParams): boolean {
  return Boolean(
    params.tags ||
      params.segments ||
      params.search ||
      params.startDate ||
      params.endDate ||
      (params.status && params.status !== 'all'),
  );
}

async function fetchContactsList(
  params: ContactsSearchParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Contact>> {
  const { data } = await apiClient.get<RawPaginatedResponse<any>>('/contacts', {
    params: {
      page: params.page,
      itemsPerPage: params.pageSize,
      ...(params.sort && { sort: params.sort, order: params.order }),
      ...buildContactFilterParams(params),
    },
    signal,
  });
  return {
    data: mapContacts(data.results),
    meta: {
      // The backend intentionally returns page-size as `totalItems` for the
      // list endpoint (to keep the response fast). Real total comes from
      // useContactsTotal — do not read meta.total from here.
      total: data.results?.length ?? 0,
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

/**
 * Total of contacts matching the current filters. Two sources:
 * - Without filters: reuses the dashboard aggregate (already fetched for
 *   the "Total contacts" card and cached for 5 minutes).
 * - With filters: hits GET /contacts?countOnly=true&...filters, which
 *   short-circuits to a single COUNT(*) in the backend.
 *
 * Mirrors the Vue2 orchestration so the list endpoint can stay fast even
 * on accounts with millions of contacts.
 */
export function useContactsTotal(params: ContactsSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;
  const filtered = hasContactFilters(params);

  const dashboard = useContactDashboard();

  const filteredCount = useQuery({
    queryKey: [...queryKeys.contacts.all, 'total', { accountId, filters: buildContactFilterParams(params) }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<unknown>>('/contacts', {
        params: { countOnly: true, ...buildContactFilterParams(params) },
        signal,
      });
      return Number(data.totalItems) || 0;
    },
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated' && filtered,
  });

  if (filtered) {
    return {
      total: filteredCount.data ?? 0,
      isLoading: filteredCount.isLoading,
    };
  }

  return {
    total: dashboard.data?.total ?? 0,
    isLoading: dashboard.isLoading,
  };
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
      const { data: result } = await apiClient.put<Contact>(`/contacts/${uuid}`, data);
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

export function useBulkDeleteContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      const { data } = await apiClient.post<{ deleted: number }>('/contacts/bulk-delete', { ids });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success(i18n.t('contacts.bulkDeleteSuccess', { count: data.deleted }));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('contacts.bulkDeleteError'));
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
