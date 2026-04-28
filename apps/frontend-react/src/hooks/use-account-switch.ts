import { useCallback, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { useAppStore } from '@/stores/app-store';
import type { MeResponse, AccountConfig, Permission, RoleCode, UserAccountMe } from '@/types';

export function useAccountSwitch() {
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);

  const switchAccount = useCallback(
    async (userAccount: UserAccountMe) => {
      const store = useAppStore.getState();
      if (store.auth.status !== 'authenticated') return;
      if (store.auth.account.id === userAccount.accountId) return;

      // Abort any in-flight switch
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      store.setSwitching(store.auth.user, store.auth.account.id);

      // Remove previous account's queries
      queryClient.removeQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key !== 'auth';
        },
      });

      try {
        const [meRes, configsRes] = await Promise.all([
          apiClient.get<MeResponse>(`/users/me`, {
            params: { accountId: userAccount.accountId },
            signal: ac.signal,
          }),
          apiClient.get<AccountConfig[]>('/accounts/configs', {
            signal: ac.signal,
            headers: { 'Account-Id': userAccount.accountId },
          }),
        ]);

        if (ac.signal.aborted) return;

        const me = meRes.data;
        const configs = configsRes.data;
        const timezone = configs.find((c) => c.name === 'timezone')?.value || 'America/Sao_Paulo';
        const currentUa = me.userAccount.find((ua) => ua.accountId === userAccount.accountId);

        useAppStore.getState().setAuthenticated({
          user: me,
          account: userAccount.account,
          userAccounts: me.userAccount,
          permissions: me.permissions as Permission[],
          effectiveRole: me.effectiveRole as RoleCode,
          globalRole: (me.globalRole as RoleCode) || null,
          isMasterUser: currentUa?.isMasterUser ?? false,
          accountConfigs: configs,
          timezone,
        });

        navigate({ to: '/analytics/dashboard', replace: true });
      } catch (err) {
        if (ac.signal.aborted) return;
        console.error('Account switch failed:', err);
        useAppStore.getState().setError('Erro ao trocar de conta');
      }
    },
    [navigate],
  );

  return { switchAccount };
}
