// Adapted from features/super-admin/users — keep in sync until shared module is extracted.
// All operations are account-scoped: they target the ACTIVE account only and never
// touch a user's global role or delete a user globally.
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { useAccountId } from '@/features/settings/use-settings';
import { toPaginatedResponse, type RawPaginatedResponse } from '@/types';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { AccountUser } from './types';
import type { AccountUserCreateValues, AccountUserEditValues } from './user-schema';

export function useAccountUsersList(params: ListSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = useAccountId();

  return useQuery({
    queryKey: queryKeys.accountUsers.list(accountId, params),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<AccountUser>>('/users', {
        params: {
          page: params.page,
          itemsPerPage: params.pageSize,
          ...(params.search && { search: params.search }),
        },
        signal,
      });
      return toPaginatedResponse(data);
    },
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useAccountUser(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = useAccountId();

  return useQuery({
    queryKey: queryKeys.accountUsers.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<AccountUser>(`/users/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateAccountUser() {
  const queryClient = useQueryClient();
  const accountId = useAccountId();

  return useMutation({
    mutationFn: async (values: AccountUserCreateValues) => {
      // The new user is provisioned and attached to the active account with the
      // chosen role as an account-level override. globalRoleCode is left at the
      // backend default (editor) — account admins never set a global role.
      // NOTE (F7 / D3): the admin sets the initial password directly here. There is
      // no invite-by-email flow yet — an emailed activation link is a known gap to
      // revisit when the auth provider supports it.
      const payload = {
        name: values.name,
        email: values.email,
        password: values.password,
        accounts: [{ accountId, isMasterUser: false, roleOverrideCode: values.roleCode }],
      };
      const { data } = await apiClient.post<AccountUser>('/users', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accountUsers.all });
      toast.success(i18n.t('account.users.toasts.created'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('account.users.toasts.errorGeneric'));
    },
  });
}

/** Updates the user's name/email only — never the global or account role. */
export function useUpdateAccountUserProfile(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: Pick<AccountUserEditValues, 'name' | 'email'>) => {
      const { data } = await apiClient.put<AccountUser>(`/users/${id}`, {
        name: values.name,
        email: values.email,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accountUsers.all });
      toast.success(i18n.t('account.users.toasts.updated'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('account.users.toasts.errorGeneric'));
    },
  });
}

/** Updates the user's role override in the ACTIVE account. */
export function useUpdateAccountUserRole(userId: number) {
  const queryClient = useQueryClient();
  const accountId = useAccountId();

  return useMutation({
    mutationFn: async (roleCode: string) => {
      const { data } = await apiClient.put(`/users/${userId}/accounts/${accountId}/role`, {
        roleOverrideCode: roleCode,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accountUsers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountUsers.detail(accountId, userId) });
      toast.success(i18n.t('account.users.toasts.updated'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('account.users.toasts.errorGeneric'));
    },
  });
}

/** Removes the user's membership in the ACTIVE account (does NOT delete the user). */
export function useRemoveAccountMembership() {
  const queryClient = useQueryClient();
  const accountId = useAccountId();

  return useMutation({
    mutationFn: async (userId: number) => {
      await apiClient.delete(`/users/${userId}/accounts/${accountId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accountUsers.all });
      toast.success(i18n.t('account.users.toasts.removed'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('account.users.toasts.errorGeneric'));
    },
  });
}

export function useBulkRemoveAccountMembership() {
  const queryClient = useQueryClient();
  const accountId = useAccountId();
  const auth = useAppStore((s) => s.auth);
  const currentUserId = auth.status === 'authenticated' ? auth.user.id : undefined;

  return useMutation({
    mutationFn: async (userIds: number[]) => {
      // Safety net independent of the table's row-selection guard: never attempt to
      // remove the current user's own membership (backend also blocks it with 403) (F9).
      const ids = currentUserId !== undefined ? userIds.filter((id) => id !== currentUserId) : userIds;
      const results = await Promise.allSettled(ids.map((id) => apiClient.delete(`/users/${id}/accounts/${accountId}`)));
      const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      const succeeded = ids.length - failures.length;
      const firstReason = failures.length
        ? (failures[0].reason as { response?: { data?: { message?: string } } })?.response?.data?.message
        : undefined;
      return { removed: succeeded, failed: failures.length, total: ids.length, firstReason };
    },
    onSettled: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accountUsers.all });
      if (!result) return;
      if (result.failed === 0) {
        toast.success(i18n.t('account.users.toasts.removed'));
      } else {
        toast.error(result.firstReason ?? i18n.t('account.users.toasts.errorGeneric'));
      }
    },
  });
}
