import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import type { AccountConfig, Permission, RoleCode } from '@/types';
import type { AccountConfigUpdate } from './types';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

/** Read a config value from the store */
export function useAccountConfig(name: string): string {
  return useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return '';
    const config = s.auth.accountConfigs.find((c) => c.name === name);
    return config?.value ?? '';
  });
}

/** Read all account configs from the store */
export function useAccountConfigs(): AccountConfig[] {
  return useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return [];
    return s.auth.accountConfigs;
  });
}

/** Read the current account ID */
export function useAccountId(): number {
  return useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return 0;
    return s.auth.account.id;
  });
}

/** Read the timezone from the store */
export function useTimezone(): string {
  return useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return '';
    return s.auth.timezone;
  });
}

/** Re-fetch account configs from the API and update the store in-place */
export function useRefreshAccountConfigs() {
  return useCallback(async () => {
    const auth = useAppStore.getState().auth;
    if (auth.status !== 'authenticated') return;
    const res = await apiClient.get<AccountConfig[]>('/accounts/configs');
    const configs = res.data;
    const timezone = configs.find((c) => c.name === 'timezone')?.value || 'America/Sao_Paulo';
    useAppStore.getState().setAuthenticated({
      user: auth.user,
      account: auth.account,
      userAccounts: auth.userAccounts,
      permissions: [...auth.permissions] as Permission[],
      effectiveRole: auth.effectiveRole as RoleCode,
      globalRole: auth.globalRole,
      isMasterUser: auth.isMasterUser,
      accountConfigs: configs,
      timezone,
    });
  }, []);
}

export interface ManagedApiKey {
  id: number;
  name: string;
  status: string;
  source: string;
  roleCode: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function useListApiKeys(accountId: number) {
  return useQuery({
    queryKey: ['api-keys', accountId],
    queryFn: async () => {
      const res = await apiClient.get<{ results: ManagedApiKey[] }>(`/accounts/${accountId}/api-keys`, {
        params: { itemsPerPage: 100 },
      });
      return res.data.results;
    },
    enabled: accountId > 0,
  });
}

export function useCreateApiKey(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await apiClient.post<{ id: number; name: string; status: string; apiKey: string }>(
        `/accounts/${accountId}/api-keys`,
        { name },
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys', accountId] }),
    onError: (error) => toast.error(extractApiErrorMessage(error) ?? i18n.t('settings.apiKeysCreateError')),
  });
}

export function useRevokeApiKey(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (keyId: number) => {
      await apiClient.post(`/accounts/${accountId}/api-keys/${keyId}/revoke`);
    },
    onSuccess: () => {
      toast.success(i18n.t('settings.apiKeysRevokeOk'));
      qc.invalidateQueries({ queryKey: ['api-keys', accountId] });
    },
    onError: (error) => toast.error(extractApiErrorMessage(error) ?? i18n.t('settings.apiKeysRevokeError')),
  });
}

/** Save account configs */
export function useUpdateAccountConfigs() {
  const refresh = useRefreshAccountConfigs();
  return useMutation({
    mutationFn: async ({ accountId, configs }: { accountId: number; configs: AccountConfigUpdate[] }) => {
      await apiClient.put(`/accounts/providers/${accountId}`, configs);
    },
    onSuccess: async () => {
      toast.success(i18n.t('settings.saveSuccess'));
      await refresh();
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('settings.saveError'));
    },
  });
}
