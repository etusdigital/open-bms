import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { SuperAdminUser } from './types';
import type { SuperAdminCreateUserValues, SuperAdminEditUserValues } from './user-schema';

export function useSuperAdminUsersList(params: ListSearchParams) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: queryKeys.superAdmin.users.list(params),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<SuperAdminUser>>('/users/all', {
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

export function useSuperAdminUser(id: number) {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: queryKeys.superAdmin.users.detail(id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<SuperAdminUser>(`/users/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateSuperAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SuperAdminCreateUserValues) => {
      const { data } = await apiClient.post<SuperAdminUser>('/users', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.users.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('superAdmin.users.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ??
          i18n.t('common.createError', { entity: i18n.t('superAdmin.users.entityName') }),
      );
    },
  });
}

export function useUpdateSuperAdminUser(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SuperAdminEditUserValues) => {
      const { data } = await apiClient.put<SuperAdminUser>(`/users/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.superAdmin.users.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.users.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('superAdmin.users.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ??
          i18n.t('common.updateError', { entity: i18n.t('superAdmin.users.entityName') }),
      );
    },
  });
}

export function useUpdateUserGlobalRole(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (globalRoleCode: string) => {
      const { data } = await apiClient.put(`/users/${id}/global-role`, { globalRoleCode });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.users.detail(id) });
      toast.success(i18n.t('superAdmin.users.roleUpdated'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('common.error'));
    },
  });
}

export function useAddUserAccountMembership(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, roleOverrideCode }: { accountId: number; roleOverrideCode?: string | null }) => {
      const { data } = await apiClient.post(`/users/${id}/accounts`, { accountId, roleOverrideCode });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.users.detail(id) });
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('common.error'));
    },
  });
}

export function useUpdateUserAccountRole(userId: number, accountId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleOverrideCode: string | null) => {
      const { data } = await apiClient.put(`/users/${userId}/accounts/${accountId}/role`, { roleOverrideCode });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.users.detail(userId) });
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('common.error'));
    },
  });
}

export function useRemoveUserAccountMembership(userId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: number) => {
      await apiClient.delete(`/users/${userId}/accounts/${accountId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.users.detail(userId) });
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('common.error'));
    },
  });
}

export function useDeleteSuperAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.users.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('superAdmin.users.entityName') }));
    },
    onError: (error) => {
      toast.error(
        extractApiErrorMessage(error) ??
          i18n.t('common.deleteError', { entity: i18n.t('superAdmin.users.entityName') }),
      );
    },
  });
}

export function useBulkDeleteSuperAdminUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(ids.map((id) => apiClient.delete(`/users/${id}`)));
      const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      const succeeded = ids.length - failures.length;
      const firstReason = failures.length
        ? (failures[0].reason as { response?: { data?: { message?: string } } })?.response?.data?.message
        : undefined;
      return { deleted: succeeded, failed: failures.length, total: ids.length, firstReason };
    },
    // onSettled rather than onSuccess: partial-success runs still deleted
    // rows and the list cache must refresh either way.
    onSettled: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.users.all });
      if (!result) return;
      if (result.failed === 0) {
        toast.success(i18n.t('superAdmin.users.bulkDeleteSuccess', { count: result.deleted }));
      } else if (result.deleted === 0) {
        toast.error(result.firstReason ?? i18n.t('common.deleteError', { entity: i18n.t('superAdmin.users.entityName') }));
      } else {
        toast.error(
          i18n.t('superAdmin.users.bulkDeletePartial', {
            succeeded: result.deleted,
            total: result.total,
            reason: result.firstReason ?? '',
          }),
        );
      }
    },
  });
}

export function useRequestUserPasswordReset(id: number) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/users/${id}/reset-password`);
      return data;
    },
    onSuccess: () => {
      toast.success(i18n.t('superAdmin.users.passwordResetSent'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('superAdmin.users.passwordResetError'));
    },
  });
}
