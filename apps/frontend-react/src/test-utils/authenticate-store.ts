import { useAppStore } from '@/stores/app-store';

interface AuthenticateOptions {
  permissions?: string[];
  effectiveRole?: string;
  accountConfigs?: { accountId: number; name: string; value: string; isLoadConfig: boolean }[];
  timezone?: string;
}

export function authenticateStore(options: AuthenticateOptions = {}) {
  const { permissions = [], effectiveRole = 'user', accountConfigs = [], timezone = 'UTC' } = options;

  useAppStore.getState().setAuthenticated({
    user: {
      id: 1,
      name: 'Test',
      email: 'test@test.com',
      profile: '',
      providerId: 'auth0|123',
      status: 'active',
    },
    account: {
      id: 10,
      name: 'Account',
      description: '',
      isActive: true,
      groupId: 1,
    },
    userAccounts: [],
    permissions,
    effectiveRole,
    globalRole: null,
    isMasterUser: false,
    accountConfigs,
    timezone,
  });
}

export function resetAuthStore() {
  useAppStore.setState({ auth: { status: 'idle' }, sidebarCollapsed: false, savedAccountId: null });
}
