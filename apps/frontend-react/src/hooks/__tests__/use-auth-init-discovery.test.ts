// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests the auth init flow:
 * - Always calls GET /users/me (without accountId) to get fresh account list
 * - Falls back to savedAccountId if still valid, otherwise uses first account
 * - Detects removed accounts (savedAccountId no longer in list)
 * - Uses discovery account list in the store (not the scoped call's list)
 */

// Mock our auth shim — useAuthInit only reads isAuthenticated/user from it.
vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: {
      id: 1,
      name: 'Test',
      email: 'test@test.com',
      picture: null,
      providerId: 'local|abc',
    },
  }),
}));

const discoveryAccounts = [
  { accountId: 42, isMasterUser: false, account: { id: 42, name: 'AccountA', isInternal: false } },
  { accountId: 99, isMasterUser: false, account: { id: 99, name: 'AccountB', isInternal: false } },
  { accountId: 200, isMasterUser: true, account: { id: 200, name: 'AccountC', isInternal: true } },
];

const discoveryResponse = {
  id: 1,
  name: 'Test',
  email: 'test@test.com',
  profile: '',
  providerId: 'auth0|123',
  effectiveRole: 'admin',
  globalRole: null,
  permissions: ['analytics:dashboard_view'],
  userAccount: discoveryAccounts,
};

const scopedResponse = {
  id: 1,
  name: 'Test',
  email: 'test@test.com',
  profile: '',
  providerId: 'auth0|123',
  effectiveRole: 'editor',
  globalRole: null,
  permissions: ['analytics:dashboard_view', 'campaigns:view'],
  userAccount: discoveryAccounts,
};

const configsResponse = [{ name: 'timezone', value: 'UTC' }];

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: (...args: any[]) => mockPost(...args),
    get: (...args: any[]) => mockGet(...args),
  },
}));

import { renderHook, waitFor } from '@testing-library/react';
import { useAuthInit } from '../use-auth-init';
import { useAppStore } from '@/stores/app-store';

describe('useAuthInit - account discovery on every load', () => {
  beforeEach(() => {
    useAppStore.getState().resetAuth();
    useAppStore.setState({ savedAccountId: null });
    mockPost.mockReset();
    mockGet.mockReset();

    // POST /users/login is NOT called in local mode — backend returns 410 Gone.
    // It's only called in Auth0 mode (see use-auth-init.ts) for audit logging.
    mockPost.mockRejectedValue(new Error('POST should not be called in local mode'));

    mockGet.mockImplementation((url: string, opts?: any) => {
      if (url.includes('/accounts/configs')) {
        return Promise.resolve({ data: configsResponse });
      }
      // Discovery call (no params) returns full list
      // Scoped call (with accountId) returns scoped permissions
      if (opts?.params?.accountId) {
        return Promise.resolve({ data: scopedResponse });
      }
      return Promise.resolve({ data: discoveryResponse });
    });
  });

  it('always calls GET /users/me without accountId first to refresh account list', async () => {
    useAppStore.setState({ savedAccountId: 42 });

    renderHook(() => useAuthInit());

    await waitFor(() => {
      expect(useAppStore.getState().auth.status).toBe('authenticated');
    });

    const meCalls = mockGet.mock.calls.filter(([url]: [string]) => url === '/users/me');
    expect(meCalls.length).toBe(2);
    // First call: discovery (no accountId param)
    expect(meCalls[0][1]).not.toHaveProperty('params');
    // Second call: with accountId
    expect(meCalls[1][1]).toHaveProperty('params', { accountId: 42 });
  });

  it('uses savedAccountId when it is still in the fresh account list', async () => {
    useAppStore.setState({ savedAccountId: 99 });

    renderHook(() => useAuthInit());

    await waitFor(() => {
      const auth = useAppStore.getState().auth;
      expect(auth.status).toBe('authenticated');
      if (auth.status === 'authenticated') {
        expect(auth.account.id).toBe(99);
      }
    });
  });

  it('falls back to first account when savedAccountId is no longer in the list', async () => {
    useAppStore.setState({ savedAccountId: 777 }); // removed account

    renderHook(() => useAuthInit());

    await waitFor(() => {
      const auth = useAppStore.getState().auth;
      expect(auth.status).toBe('authenticated');
      if (auth.status === 'authenticated') {
        expect(auth.account.id).toBe(42); // first in list
      }
    });
  });

  it('uses first account when no savedAccountId', async () => {
    renderHook(() => useAuthInit());

    await waitFor(() => {
      const auth = useAppStore.getState().auth;
      expect(auth.status).toBe('authenticated');
      if (auth.status === 'authenticated') {
        expect(auth.account.id).toBe(42);
      }
    });
  });

  it('sets error when discovery returns no accounts', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/accounts/configs')) {
        return Promise.resolve({ data: configsResponse });
      }
      return Promise.resolve({
        data: { ...discoveryResponse, userAccount: [] },
      });
    });

    renderHook(() => useAuthInit());

    await waitFor(() => {
      expect(useAppStore.getState().auth.status).toBe('error');
    });
  });

  it('stores the full account list from discovery, not from the scoped call', async () => {
    renderHook(() => useAuthInit());

    await waitFor(() => {
      const auth = useAppStore.getState().auth;
      expect(auth.status).toBe('authenticated');
      if (auth.status === 'authenticated') {
        // Should have all 3 accounts from discovery
        expect(auth.userAccounts).toHaveLength(3);
        expect(auth.userAccounts.map((ua) => ua.accountId)).toEqual([42, 99, 200]);
      }
    });
  });

  it('uses permissions from the scoped call, not the discovery call', async () => {
    renderHook(() => useAuthInit());

    await waitFor(() => {
      const auth = useAppStore.getState().auth;
      expect(auth.status).toBe('authenticated');
      if (auth.status === 'authenticated') {
        // Scoped response has 'editor' role and extra 'campaigns:view' permission
        expect(auth.effectiveRole).toBe('editor');
        expect(auth.permissions.has('campaigns:view')).toBe(true);
      }
    });
  });
});
