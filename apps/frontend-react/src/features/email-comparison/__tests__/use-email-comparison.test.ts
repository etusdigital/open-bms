// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: {
        '1': {
          general: {
            delivered: 100,
            open: 50,
            click: 20,
            unsubscribe: 1,
            bounce: 2,
            blocked: 0,
            sent: 0,
            close: 0,
          },
          daily: {
            '2026-03-30': {
              date: '2026-03-30',
              delivered: 50,
              open: 25,
              click: 10,
              unsubscribe: 0,
              bounce: 1,
              blocked: 0,
              sent: 0,
              close: 0,
            },
          },
        },
        '2': {
          general: {
            delivered: 80,
            open: 40,
            click: 15,
            unsubscribe: 0,
            bounce: 1,
            blocked: 0,
            sent: 0,
            close: 0,
          },
          daily: {
            '2026-03-30': {
              date: '2026-03-30',
              delivered: 40,
              open: 20,
              click: 8,
              unsubscribe: 0,
              bounce: 0,
              blocked: 0,
              sent: 0,
              close: 0,
            },
          },
        },
      },
    }),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);

describe('useMessageComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /statistics/email with messages and groupByMessage', async () => {
    const { useMessageComparison } = await import('../use-email-comparison');
    const { result } = renderHook(() => useMessageComparison('email', [1, 2], '2026-03-24', '2026-03-30'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      '/statistics/email',
      expect.objectContaining({
        params: {
          startDate: '2026-03-24',
          endDate: '2026-03-30',
          messages: [1, 2],
          groupByMessage: true,
        },
      }),
    );
  });

  it('calls GET /statistics/push for web-push type', async () => {
    const { useMessageComparison } = await import('../use-email-comparison');
    const { result } = renderHook(() => useMessageComparison('web-push', [3], '2026-03-24', '2026-03-30'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      '/statistics/push',
      expect.objectContaining({
        params: {
          startDate: '2026-03-24',
          endDate: '2026-03-30',
          messages: [3],
          groupByMessage: true,
        },
      }),
    );
  });

  it('returns comparison data keyed by message ID', async () => {
    const { useMessageComparison } = await import('../use-email-comparison');
    const { result } = renderHook(() => useMessageComparison('email', [1, 2], '2026-03-24', '2026-03-30'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.['1'].general.delivered).toBe(100);
    expect(result.current.data?.['2'].general.delivered).toBe(80);
  });

  it('is disabled when messageIds is empty', async () => {
    const { useMessageComparison } = await import('../use-email-comparison');
    const { result } = renderHook(() => useMessageComparison('email', [], '2026-03-24', '2026-03-30'), {
      wrapper: createQueryWrapper(),
    });

    // Should not make the call
    expect(mockGet).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
