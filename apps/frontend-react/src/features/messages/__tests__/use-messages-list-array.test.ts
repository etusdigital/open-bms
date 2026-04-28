// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import { TRANSACTIONAL_TYPES } from '../types';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: { results: [], totalItems: 0, page: 1, itemsPerPage: 10 },
    }),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);

const baseParams = {
  page: 1,
  pageSize: 10,
  search: '',
  sort: '',
  order: 'asc' as const,
};

describe('useMessagesList — array type support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('passes a single MessageType string as type param (backwards compatible)', async () => {
    const { useMessagesList } = await import('../use-messages');
    const { result } = renderHook(() => useMessagesList(baseParams, 'email'), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      '/messages',
      expect.objectContaining({
        params: expect.objectContaining({ type: 'email' }),
      }),
    );
  });

  it('passes an array of types as type param when given TRANSACTIONAL_TYPES', async () => {
    const { useMessagesList } = await import('../use-messages');
    const { result } = renderHook(() => useMessagesList(baseParams, TRANSACTIONAL_TYPES), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      '/messages',
      expect.objectContaining({
        params: expect.objectContaining({
          type: TRANSACTIONAL_TYPES,
        }),
      }),
    );
  });

  it('produces different queryKeys for different array inputs (for cache correctness)', async () => {
    const { useMessagesList } = await import('../use-messages');

    const { result: result1 } = renderHook(() => useMessagesList(baseParams, ['transactional-email']), {
      wrapper: createQueryWrapper(),
    });
    const { result: result2 } = renderHook(() => useMessagesList(baseParams, ['transactional-sms']), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
      expect(result2.current.isSuccess).toBe(true);
    });

    // Both calls should have been made separately (not deduped by cache)
    const calls = mockGet.mock.calls.filter((c) => c[0] === '/messages');
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});
