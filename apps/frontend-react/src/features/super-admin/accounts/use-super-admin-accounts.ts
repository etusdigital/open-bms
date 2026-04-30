import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';
import type { SuperAdminAccount } from './types';
import type { SuperAdminCreateAccountValues, SuperAdminEditAccountValues } from './account-schema';

export function useSuperAdminAccountsAll() {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: queryKeys.superAdmin.accounts.all,
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<SuperAdminAccount[]>('/accounts/all', { signal });
      return data;
    },
    enabled: auth.status === 'authenticated',
  });
}

export function useSuperAdminAccount(id: number) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: queryKeys.superAdmin.accounts.detail(id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<SuperAdminAccount>(`/accounts/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateSuperAdminAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SuperAdminCreateAccountValues) => {
      const { data } = await apiClient.post<{ account: SuperAdminAccount; dns?: Record<string, unknown> }>(
        '/accounts',
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.accounts.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('superAdmin.accounts.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ??
          i18n.t('common.createError', { entity: i18n.t('superAdmin.accounts.entityName') }),
      );
    },
  });
}

export function useUpdateSuperAdminAccount(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SuperAdminEditAccountValues) => {
      const { data } = await apiClient.put<SuperAdminAccount>(`/accounts/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.superAdmin.accounts.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.accounts.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('superAdmin.accounts.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ??
          i18n.t('common.updateError', { entity: i18n.t('superAdmin.accounts.entityName') }),
      );
    },
  });
}

export function useSuspendSuperAdminAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const { data } = await apiClient.put<SuperAdminAccount>(`/accounts/${id}/suspend`, { isActive });
      return data;
    },
    onSuccess: (_data, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.accounts.all });
      const key = isActive ? 'superAdmin.accounts.reactivated' : 'superAdmin.accounts.suspended';
      toast.success(i18n.t(key));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('common.error'));
    },
  });
}

export function useDeleteSuperAdminAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.accounts.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('superAdmin.accounts.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ??
          i18n.t('common.deleteError', { entity: i18n.t('superAdmin.accounts.entityName') }),
      );
    },
  });
}

export function useBulkDeleteSuperAdminAccounts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(ids.map((id) => apiClient.delete(`/accounts/${id}`)));
      const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      const succeeded = ids.length - failures.length;
      const firstReason = failures.length
        ? (failures[0].reason as { response?: { data?: { message?: string } } })?.response?.data?.message
        : undefined;
      return { deleted: succeeded, failed: failures.length, total: ids.length, firstReason };
    },
    // onSettled rather than onSuccess because a partial-success run still
    // deleted rows and the list cache must refresh — otherwise the deleted
    // rows linger in the UI and the operator re-clicks them into 404s.
    onSettled: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.accounts.all });
      if (!result) return;
      if (result.failed === 0) {
        toast.success(i18n.t('superAdmin.accounts.bulkDeleteSuccess', { count: result.deleted }));
      } else if (result.deleted === 0) {
        toast.error(result.firstReason ?? i18n.t('common.deleteError', { entity: i18n.t('superAdmin.accounts.entityName') }));
      } else {
        toast.error(
          i18n.t('superAdmin.accounts.bulkDeletePartial', {
            succeeded: result.deleted,
            total: result.total,
            reason: result.firstReason ?? '',
          }),
        );
      }
    },
  });
}
