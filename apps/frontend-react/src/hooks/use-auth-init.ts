import { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { apiClient } from '@/lib/api-client';
import { identifyClarityUser, Clarity } from '@/lib/clarity';
import { useAppStore } from '@/stores/app-store';
import { useAuth } from '@/features/auth/use-auth';
import type { MeResponse, UserAccountMe, AccountConfig, Permission, RoleCode, Account } from '@/types';

const AUTH_PROVIDER = (import.meta.env.VITE_AUTH_PROVIDER ?? 'local') as 'local' | 'auth0';

export function useAuthInit() {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    // Token presence is the only gate. In local mode the user is hydrated
    // from /users/me below; on hard reload there's no `user` yet because
    // the previous refresh only restored the access token.
    if (!isAuthenticated) return;

    const ac = new AbortController();

    async function init() {
      const store = useAppStore.getState();
      if (store.auth.status === 'authenticated') return;
      store.setAuthenticating();

      try {
        // POST /users/login is auth0-only — it syncs the IdP user into the
        // local DB and writes an audit log entry. In local mode the auth
        // provider already created the user (bootstrap admin or admin panel)
        // and POST /users/login responds 410 Gone (see msgops-api).
        if (AUTH_PROVIDER === 'auth0' && user) {
          await apiClient.post(
            '/users/login',
            {
              name: user.name,
              email: user.email,
              picture: 'picture' in user ? (user as { picture?: string }).picture : undefined,
            },
            { signal: ac.signal },
          );
          if (ac.signal.aborted) return;
        }

        // Fetch fresh account list (always, to pick up added/removed accounts)
        const discoveryRes = await apiClient.get<MeResponse>('/users/me', { signal: ac.signal });
        if (ac.signal.aborted) return;

        const freshAccounts = discoveryRes.data.userAccount;
        if (!freshAccounts?.length) {
          store.setError('Nenhuma conta atribuída');
          return;
        }

        const savedAccountId = useAppStore.getState().savedAccountId;
        const savedStillValid = savedAccountId && freshAccounts.some((ua) => ua.accountId === savedAccountId);
        const accountId = savedStillValid ? savedAccountId : freshAccounts[0].accountId;

        const [meRes, configsRes] = await Promise.all([
          apiClient.get<MeResponse>(`/users/me`, {
            params: { accountId },
            signal: ac.signal,
          }),
          apiClient.get<AccountConfig[]>('/accounts/configs', {
            signal: ac.signal,
            headers: { 'Account-Id': accountId },
          }),
        ]);
        if (ac.signal.aborted) return;

        const me = meRes.data;
        const configs = configsRes.data;

        const currentUserAccount = me.userAccount.find((ua) => ua.accountId === accountId);

        if (!currentUserAccount) {
          store.setError('Nenhuma conta atribuída');
          return;
        }

        setAuthenticatedFromMe(me, freshAccounts, configs, currentUserAccount.account);
      } catch (err) {
        if (ac.signal.aborted) return;
        console.error('Auth init failed:', err);
        store.setError('Erro ao carregar dados do usuário');
      }
    }

    function setAuthenticatedFromMe(
      me: MeResponse,
      allAccounts: UserAccountMe[],
      configs: AccountConfig[],
      account: Account,
    ) {
      const timezone = configs.find((c) => c.name === 'timezone')?.value || 'America/Sao_Paulo';
      const currentUa = allAccounts.find((ua) => ua.accountId === account.id);

      useAppStore.getState().setAuthenticated({
        user: me,
        account,
        userAccounts: allAccounts,
        permissions: me.permissions as Permission[],
        effectiveRole: me.effectiveRole as RoleCode,
        globalRole: (me.globalRole as RoleCode) || null,
        isMasterUser: currentUa?.isMasterUser ?? false,
        accountConfigs: configs,
        timezone,
      });

      Sentry.setUser({ id: String(me.id), email: me.email });
      Sentry.setTag('account_id', String(account.id));
      identifyClarityUser(String(me.id));

      const claritySessionId = (Clarity as unknown as Record<string, unknown>).getCurrentSessionId;
      if (typeof claritySessionId === 'function') {
        const sessionId = claritySessionId() as string | undefined;
        if (sessionId) {
          Sentry.setTag('clarity_session', sessionId);
        }
      }
    }

    init();
    return () => ac.abort();
  }, [isAuthenticated, user]);
}
