import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../app-store';

describe('app-store', () => {
  beforeEach(() => {
    // Reset store to initial state between tests
    useAppStore.setState({
      auth: { status: 'idle' },
      sidebarCollapsed: false,
      savedAccountId: null,
    });
  });

  describe('auth state transitions', () => {
    it('starts in idle state', () => {
      expect(useAppStore.getState().auth.status).toBe('idle');
    });

    it('transitions to authenticating', () => {
      useAppStore.getState().setAuthenticating();
      expect(useAppStore.getState().auth.status).toBe('authenticating');
    });

    it('transitions to authenticated with all fields', () => {
      const data = {
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
          name: 'Account 1',
          description: '',
          isActive: true,
          groupId: 1,
        },
        userAccounts: [],
        permissions: ['analytics:dashboard_view' as const, 'campaigns:view' as const],
        effectiveRole: 'admin' as const,
        globalRole: null,
        isMasterUser: false,
        accountConfigs: [],
        timezone: 'America/Sao_Paulo',
      };

      useAppStore.getState().setAuthenticated(data);

      const { auth } = useAppStore.getState();
      expect(auth.status).toBe('authenticated');
      if (auth.status === 'authenticated') {
        expect(auth.user.name).toBe('Test');
        expect(auth.account.id).toBe(10);
        expect(auth.permissions).toBeInstanceOf(Set);
        expect(auth.permissions.has('analytics:dashboard_view')).toBe(true);
        expect(auth.permissions.has('campaigns:view')).toBe(true);
        expect(auth.effectiveRole).toBe('admin');
        expect(auth.timezone).toBe('America/Sao_Paulo');
      }
    });

    it('saves accountId when authenticated', () => {
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
          id: 42,
          name: 'Account',
          description: '',
          isActive: true,
          groupId: 1,
        },
        userAccounts: [],
        permissions: [],
        effectiveRole: 'admin',
        globalRole: null,
        isMasterUser: false,
        accountConfigs: [],
        timezone: 'UTC',
      });

      expect(useAppStore.getState().savedAccountId).toBe(42);
    });

    it('transitions to switching', () => {
      const user = { id: 1, name: 'Test', email: 'test@test.com', profile: '', status: 'active' };
      useAppStore.getState().setSwitching(user, 10);

      const { auth } = useAppStore.getState();
      expect(auth.status).toBe('switching');
      if (auth.status === 'switching') {
        expect(auth.user.name).toBe('Test');
        expect(auth.previousAccountId).toBe(10);
      }
    });

    it('transitions to error', () => {
      useAppStore.getState().setError('Something failed');
      const { auth } = useAppStore.getState();
      expect(auth.status).toBe('error');
      if (auth.status === 'error') {
        expect(auth.error).toBe('Something failed');
      }
    });

    it('resets auth to idle and clears savedAccountId', () => {
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
        permissions: [],
        effectiveRole: 'admin',
        globalRole: null,
        isMasterUser: false,
        accountConfigs: [],
        timezone: 'UTC',
      });

      useAppStore.getState().resetAuth();

      expect(useAppStore.getState().auth.status).toBe('idle');
      expect(useAppStore.getState().savedAccountId).toBeNull();
    });
  });

  describe('sidebar', () => {
    it('defaults to not collapsed', () => {
      expect(useAppStore.getState().sidebarCollapsed).toBe(false);
    });

    it('toggles sidebar collapsed state', () => {
      useAppStore.getState().setSidebarCollapsed(true);
      expect(useAppStore.getState().sidebarCollapsed).toBe(true);

      useAppStore.getState().setSidebarCollapsed(false);
      expect(useAppStore.getState().sidebarCollapsed).toBe(false);
    });
  });
});
