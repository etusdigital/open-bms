// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: [
        { id: 10, name: 'Active Users' },
        { id: 20, name: 'New Signups' },
      ],
    }),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);

describe('useSegmentsByAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /tags with type=segment and Account-Id header', async () => {
    const { useSegmentsByAccount } = await import('../use-segments-by-account');
    const { result } = renderHook(() => useSegmentsByAccount(55), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/tags', {
      params: { type: 'segment', accountId: 55 },
      headers: { 'Account-Id': 55 },
      signal: expect.any(AbortSignal),
    });
  });

  it('returns segment data', async () => {
    const { useSegmentsByAccount } = await import('../use-segments-by-account');
    const { result } = renderHook(() => useSegmentsByAccount(55), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].name).toBe('Active Users');
  });

  it('is disabled when accountId is 0', async () => {
    const { useSegmentsByAccount } = await import('../use-segments-by-account');
    const { result } = renderHook(() => useSegmentsByAccount(0), { wrapper: createQueryWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
