// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: {
        id: 2866,
        title: 'plusdin-cp-weekend-cc-2006',
        content: '<html><a href="x">L</a></html>',
        clickStats: [
          { key: '0', total: '156' },
          { key: '1', total: '89' },
          { key: '2', total: '45' },
        ],
      },
    }),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);

describe('useMessageClickStatistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /messages/:id/click-statistics with filterId and filterType', async () => {
    const { useMessageClickStatistics } = await import('../use-message-click-statistics');
    const { result } = renderHook(() => useMessageClickStatistics(2866, 64511, 'campaign'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/messages/2866/click-statistics', {
      params: { filterId: 64511, filterType: 'campaign' },
      signal: expect.any(AbortSignal),
    });
  });

  it('returns the message with clickStats array', async () => {
    const { useMessageClickStatistics } = await import('../use-message-click-statistics');
    const { result } = renderHook(() => useMessageClickStatistics(2866, 64511, 'campaign'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.clickStats).toEqual([
      { key: '0', total: '156' },
      { key: '1', total: '89' },
      { key: '2', total: '45' },
    ]);
  });

  it('is disabled when messageId is undefined', async () => {
    const { useMessageClickStatistics } = await import('../use-message-click-statistics');
    renderHook(() => useMessageClickStatistics(undefined, 64511, 'campaign'), { wrapper: createQueryWrapper() });

    // Give it a tick to prove it doesn't fire
    await new Promise((r) => setTimeout(r, 10));
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('is disabled when filterId is undefined', async () => {
    const { useMessageClickStatistics } = await import('../use-message-click-statistics');
    renderHook(() => useMessageClickStatistics(2866, undefined, 'campaign'), { wrapper: createQueryWrapper() });

    await new Promise((r) => setTimeout(r, 10));
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('is disabled when filterType is undefined', async () => {
    const { useMessageClickStatistics } = await import('../use-message-click-statistics');
    renderHook(() => useMessageClickStatistics(2866, 64511, undefined), { wrapper: createQueryWrapper() });

    await new Promise((r) => setTimeout(r, 10));
    expect(mockGet).not.toHaveBeenCalled();
  });
});
