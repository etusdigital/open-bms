// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth0
vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isAuthenticated: true,
    user: { name: 'Test', email: 'test@test.com', picture: '' },
  }),
}));

const meResponse = {
  id: 1,
  name: 'Test',
  email: 'test@test.com',
  profile: '',
  providerId: 'auth0|123',
  effectiveRole: 'admin',
  globalRole: null,
  permissions: ['analytics:dashboard_view'],
  userAccount: [
    {
      accountId: 1,
      isMasterUser: false,
      account: { id: 1, name: 'TestCo', isInternal: false },
    },
  ],
};

const configsResponse = [{ name: 'timezone', value: 'America/Sao_Paulo' }];

// Mock api-client — differentiate by URL
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({
      data: { userAccount: [{ accountId: 1 }] },
    }),
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/accounts/configs')) {
        return Promise.resolve({ data: configsResponse });
      }
      return Promise.resolve({ data: meResponse });
    }),
  },
}));

import { renderHook, waitFor } from '@testing-library/react';
import { useAuthInit } from '../use-auth-init';
import { useAppStore } from '@/stores/app-store';

describe('useAuthInit', () => {
  beforeEach(() => {
    useAppStore.getState().resetAuth();
  });

  it('syncs user data and sets authenticated state', async () => {
    renderHook(() => useAuthInit());

    await waitFor(() => {
      expect(useAppStore.getState().auth.status).toBe('authenticated');
    });
  });

  it('does not re-init when already authenticated', async () => {
    renderHook(() => useAuthInit());

    await waitFor(() => {
      expect(useAppStore.getState().auth.status).toBe('authenticated');
    });

    const { apiClient } = await import('@/lib/api-client');
    const postCallCount = (apiClient.post as ReturnType<typeof vi.fn>).mock.calls.length;

    // Render again — should not call POST /users/login again
    renderHook(() => useAuthInit());

    expect((apiClient.post as ReturnType<typeof vi.fn>).mock.calls.length).toBe(postCallCount);
  });

  it('sets timezone from account configs', async () => {
    renderHook(() => useAuthInit());

    await waitFor(() => {
      const auth = useAppStore.getState().auth;
      expect(auth.status).toBe('authenticated');
      if (auth.status === 'authenticated') {
        expect(auth.timezone).toBe('America/Sao_Paulo');
      }
    });
  });
});
