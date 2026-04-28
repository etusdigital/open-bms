// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: [
        {
          date: '2026-04-07',
          delivered: { '10': 6930, '11': 11294 },
          open: { '10': 7822, '11': 7113 },
        },
      ],
    }),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);

describe('useInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /statistics/insights/last7', async () => {
    const { useInsights } = await import('../use-insights');
    const { result } = renderHook(() => useInsights('last7'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/statistics/insights/last7', {
      signal: expect.any(AbortSignal),
    });
  });

  it('calls correct endpoint for last48', async () => {
    const { useInsights } = await import('../use-insights');
    const { result } = renderHook(() => useInsights('last48'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/statistics/insights/last48', {
      signal: expect.any(AbortSignal),
    });
  });

  it('returns array of daily data', async () => {
    const { useInsights } = await import('../use-insights');
    const { result } = renderHook(() => useInsights('last7'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].date).toBe('2026-04-07');
    expect(result.current.data![0].delivered).toEqual({ '10': 6930, '11': 11294 });
  });
});
