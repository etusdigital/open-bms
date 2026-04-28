// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useUpdateProfile, useUpdatePassword, useUploadAvatar } from '../api';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    put: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: { profile: 'https://cdn.example.com/pic.jpg' } }),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockPut = vi.mocked(apiClient.put);
const mockPost = vi.mocked(apiClient.post);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function authenticateStore() {
  useAppStore.getState().setAuthenticated({
    user: {
      id: 42,
      name: 'Original Name',
      email: 'original@test.com',
      profile: '',
      providerId: 'auth0|abc',
      status: 'active',
    },
    account: {
      id: 1,
      name: 'Account',
      description: '',
      isActive: true,
      isInternal: false,
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
}

describe('useUpdateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls PUT /users/me with payload (no userId in URL)', async () => {
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: 'New Name',
      email: 'new@test.com',
      settings: { language: 'en-US' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith('/users/me', {
      name: 'New Name',
      email: 'new@test.com',
      settings: { language: 'en-US' },
    });
  });

  it('does not include userId in the URL', async () => {
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: 'Test' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = mockPut.mock.calls[0][0];
    expect(url).toBe('/users/me');
    expect(url).not.toMatch(/\/users\/\d+/);
  });

  it('updates store with new name on success', async () => {
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: 'Updated Name' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { auth } = useAppStore.getState();
    expect(auth.status === 'authenticated' && auth.user.name).toBe('Updated Name');
  });
});

describe('useUpdatePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls PUT /users/me/password with only password (no userId, no providerId)', async () => {
    const { result } = renderHook(() => useUpdatePassword(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ password: 'NewPass123!' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith('/users/me/password', {
      password: 'NewPass123!',
    });
  });

  it('does not include userId or providerId in the request', async () => {
    const { result } = renderHook(() => useUpdatePassword(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ password: 'Secure1!' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, payload] = mockPut.mock.calls[0];
    expect(url).toBe('/users/me/password');
    expect(payload).not.toHaveProperty('providerId');
    expect(payload).not.toHaveProperty('userId');
  });
});

describe('useUploadAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockPost.mockResolvedValue({
      data: { profile: 'https://cdn.example.com/new-pic.jpg' },
    });
  });

  it('calls POST /users/me/profile-picture (not /buckets)', async () => {
    const file = new File(['pixels'], 'avatar.png', { type: 'image/png' });

    const { result } = renderHook(() => useUploadAvatar(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(file);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, payload] = mockPost.mock.calls[0];
    expect(url).toBe('/users/me/profile-picture');
    expect(payload).toHaveProperty('name', 'avatar.png');
    expect(payload).toHaveProperty('data');
  });

  it('does not call PUT /users/me separately for profile URL', async () => {
    const file = new File(['pixels'], 'avatar.png', { type: 'image/png' });

    const { result } = renderHook(() => useUploadAvatar(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(file);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).not.toHaveBeenCalled();
  });

  it('updates store profile on success', async () => {
    const file = new File(['pixels'], 'pic.jpg', { type: 'image/jpeg' });

    const { result } = renderHook(() => useUploadAvatar(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(file);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { auth } = useAppStore.getState();
    expect(auth.status === 'authenticated' && auth.user.profile).toBe('https://cdn.example.com/new-pic.jpg');
  });
});
