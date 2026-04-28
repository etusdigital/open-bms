// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: [
        { id: 1, poolName: 'pool-a', senderEmail: 'a@test.com', senderReplyTo: 'reply-a@test.com' },
        { id: 2, poolName: 'pool-b', senderEmail: 'b@test.com', senderReplyTo: null },
      ],
    }),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);

describe('usePoolsByAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /pools with accountId param and Account-Id header', async () => {
    const { usePoolsByAccount } = await import('../use-pools-by-account');
    const { result } = renderHook(() => usePoolsByAccount(42), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/pools', {
      params: { accountId: 42 },
      headers: { 'Account-Id': 42 },
      signal: expect.any(AbortSignal),
    });
  });

  it('returns pool data', async () => {
    const { usePoolsByAccount } = await import('../use-pools-by-account');
    const { result } = renderHook(() => usePoolsByAccount(42), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].senderEmail).toBe('a@test.com');
  });

  it('is disabled when accountId is 0', async () => {
    const { usePoolsByAccount } = await import('../use-pools-by-account');
    const { result } = renderHook(() => usePoolsByAccount(0), { wrapper: createQueryWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
