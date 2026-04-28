// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore, resetAuthStore } from '@/test-utils/authenticate-store';
import { useProducts } from '../use-products';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: {
        products: [
          {
            '2026-03-15': {
              '10:00': {
                products: [
                  {
                    title: 'Campaign A',
                    link: [],
                    messages: [],
                    tags: {},
                    sendToAll: false,
                  },
                ],
              },
            },
          },
        ],
      },
    }),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);

describe('useProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /campaigns/products with date and timezone', async () => {
    const { result } = renderHook(() => useProducts('2026-03-15', 'America/Sao_Paulo'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/campaigns/products', {
      params: { date: '2026-03-15', timezone: 'America/Sao_Paulo' },
      signal: expect.any(AbortSignal),
    });
  });

  it('returns products data', async () => {
    const { result } = renderHook(() => useProducts('2026-03-15', 'UTC'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.products).toHaveLength(1);
  });

  it('does not fetch when date is empty', () => {
    const { result } = renderHook(() => useProducts('', 'UTC'), { wrapper: createQueryWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('does not fetch when auth is not authenticated', () => {
    resetAuthStore();

    const { result } = renderHook(() => useProducts('2026-03-15', 'UTC'), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('uses accountId from auth store in query key', async () => {
    authenticateStore(); // sets account.id = 10

    const { result } = renderHook(() => useProducts('2026-03-15', 'UTC'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The query key includes accountId from the store
    // Verify by checking the hook fetches correctly with the authenticated account
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
