// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: {
        general: {
          delivered: 1000,
          open: 500,
          click: 100,
          bounce: 50,
          unsubscribe: 10,
          sent: 1100,
        },
        daily: [
          {
            date: '2026-04-01',
            delivered: 500,
            open: 250,
            click: 50,
            bounce: 25,
            unsubscribe: 5,
            sent: 550,
          },
          {
            date: '2026-04-02',
            delivered: 500,
            open: 250,
            click: 50,
            bounce: 25,
            unsubscribe: 5,
            sent: 550,
          },
        ],
      },
    }),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);

describe('useWarmupStatistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /statistics/email with correct params and Account-Id override', async () => {
    const { useWarmupStatistics } = await import('../use-warmup-statistics');
    const warmup = {
      id: 7,
      accountId: 1,
      targetAccountId: 99,
      sender: 'test@test.com',
      ippool: 'pool1',
      target: 100000,
      type: 'external',
      campaignId: 42,
      createdAt: '2026-03-01T00:00:00Z',
    };

    const { result } = renderHook(() => useWarmupStatistics(warmup), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/statistics/email', {
      params: expect.objectContaining({
        startDate: '2026-03-01',
        campaigns: [42],
        type: 'email',
      }),
      headers: { 'Account-Id': 99 },
      signal: expect.any(AbortSignal),
    });
  });

  it('returns statistics data', async () => {
    const { useWarmupStatistics } = await import('../use-warmup-statistics');
    const warmup = {
      id: 7,
      accountId: 1,
      targetAccountId: 99,
      sender: 'test@test.com',
      ippool: 'pool1',
      target: 100000,
      type: 'external',
      campaignId: 42,
      createdAt: '2026-03-01T00:00:00Z',
    };

    const { result } = renderHook(() => useWarmupStatistics(warmup), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.general.delivered).toBe(1000);
    expect(result.current.data?.daily).toHaveLength(2);
  });

  it('is disabled when warmup is undefined', async () => {
    const { useWarmupStatistics } = await import('../use-warmup-statistics');
    const { result } = renderHook(() => useWarmupStatistics(undefined), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('is disabled when warmup has no campaignId', async () => {
    const { useWarmupStatistics } = await import('../use-warmup-statistics');
    const warmup = {
      id: 7,
      accountId: 1,
      targetAccountId: 99,
      sender: 'test@test.com',
      ippool: 'pool1',
      target: 100000,
      type: 'external',
      createdAt: '2026-03-01T00:00:00Z',
    };

    const { result } = renderHook(() => useWarmupStatistics(warmup), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
