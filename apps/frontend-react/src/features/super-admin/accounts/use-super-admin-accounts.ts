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
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.accounts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.accounts.detail(id) });
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
