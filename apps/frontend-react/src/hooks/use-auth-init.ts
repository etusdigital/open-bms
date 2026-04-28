import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import * as Sentry from '@sentry/react';
import { apiClient } from '@/lib/api-client';
import { identifyClarityUser, Clarity } from '@/lib/clarity';
import { useAppStore } from '@/stores/app-store';
import type { MeResponse, UserAccountMe, AccountConfig, Permission, RoleCode, Account } from '@/types';

export function useAuthInit() {
  const { isAuthenticated, user: auth0User } = useAuth0();

  useEffect(() => {
    if (!isAuthenticated || !auth0User) return;

    const ac = new AbortController();

    async function init() {
      const store = useAppStore.getState();
      if (store.auth.status === 'authenticated') return;
      store.setAuthenticating();

      try {
        // Step 1: POST /users/login to sync user
        await apiClient.post(
          '/users/login',
          {
            name: auth0User!.name,
            email: auth0User!.email,
            picture: auth0User!.picture,
          },
          { signal: ac.signal },
        );
        if (ac.signal.aborted) return;

        // Step 2: Fetch fresh account list (always, to pick up added/removed accounts)
        const discoveryRes = await apiClient.get<MeResponse>('/users/me', { signal: ac.signal });
        if (ac.signal.aborted) return;

        const freshAccounts = discoveryRes.data.userAccount;
        if (!freshAccounts?.length) {
          store.setError('Nenhuma conta atribuída');
          return;
        }

        // Step 3: Determine which account to load
        const savedAccountId = useAppStore.getState().savedAccountId;
        const savedStillValid = savedAccountId && freshAccounts.some((ua) => ua.accountId === savedAccountId);
        const accountId = savedStillValid ? savedAccountId : freshAccounts[0].accountId;

        // Step 4: Fetch /users/me (with account context for permissions) and /accounts/configs
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

        // Step 5: Find the current account in the selected membership
        const currentUserAccount = me.userAccount.find((ua) => ua.accountId === accountId);

        if (!currentUserAccount) {
          store.setError('Nenhuma conta atribuída');
          return;
        }

        // Use full account list from discovery, permissions/role from scoped call
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

      // Identify user in observability tools
      Sentry.setUser({ id: String(me.id), email: me.email });
      Sentry.setTag('account_id', String(account.id));
      identifyClarityUser(String(me.id));

      // Link Clarity session to Sentry for cross-tool correlation
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
  }, [isAuthenticated, auth0User]);
}
