// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore, resetAuthStore } from '@/test-utils/authenticate-store';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: {
        results: [{ id: 1, title: 'Welcome email', type: 'email' }],
        totalItems: 1,
        page: 1,
        itemsPerPage: 40,
      },
    }),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);

describe('useSearchMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('fetches the initial message list when title is empty', async () => {
    const { useSearchMessages } = await import('../use-campaign-messages');
    const { result } = renderHook(() => useSearchMessages({ title: '', messageType: 'email' }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/messages', {
      params: expect.objectContaining({
        title: undefined,
        type: 'email',
        page: 1,
        itemsPerPage: 40,
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('passes the title param when the user types', async () => {
    const { useSearchMessages } = await import('../use-campaign-messages');
    const { result } = renderHook(() => useSearchMessages({ title: 'foo', messageType: 'email' }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      '/messages',
      expect.objectContaining({ params: expect.objectContaining({ title: 'foo' }) }),
    );
  });

  it('does not fetch when the user is not authenticated', async () => {
    resetAuthStore();
    const { useSearchMessages } = await import('../use-campaign-messages');
    const { result } = renderHook(() => useSearchMessages({ title: '', messageType: 'email' }), {
      wrapper: createQueryWrapper(),
    });

    await vi.waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('adds status=approved when messageType is whatsapp', async () => {
    const { useSearchMessages } = await import('../use-campaign-messages');
    const { result } = renderHook(() => useSearchMessages({ title: '', messageType: 'whatsapp' }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      '/messages',
      expect.objectContaining({
        params: expect.objectContaining({ type: 'whatsapp', status: 'approved' }),
      }),
    );
  });

  it('returns an empty array when the account has no messages of the given type', async () => {
    mockGet.mockResolvedValueOnce({
      data: { results: [], totalItems: 0, page: 1, itemsPerPage: 40 },
    });
    const { useSearchMessages } = await import('../use-campaign-messages');
    const { result } = renderHook(() => useSearchMessages({ title: '', messageType: 'email' }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
