// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import { useSuppressedList, useBulkSuppress } from '../use-suppressions';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: {
        results: [
          { id: 1, email: 'john@example.com', unsubscribedAt: '2026-01-01T00:00:00Z' },
          { id: 2, email: 'jane@example.com', blockedAt: '2026-01-02T00:00:00Z' },
        ],
        totalItems: 2,
        page: '1',
        itemsPerPage: '20',
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

const defaultParams = {
  page: 1,
  pageSize: 20,
  search: '',
  sort: '',
  order: 'asc' as const,
};

describe('useSuppressedList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /contacts/suppressed with type param', async () => {
    const { result } = renderHook(() => useSuppressedList('unsubscribed', defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/contacts/suppressed', {
      params: expect.objectContaining({
        type: 'unsubscribed',
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('passes search as title param', async () => {
    const { result } = renderHook(() => useSuppressedList('blocked', { ...defaultParams, search: 'john' }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/contacts/suppressed', {
      params: expect.objectContaining({
        type: 'blocked',
        title: 'john',
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('returns suppressed contact data', async () => {
    const { result } = renderHook(() => useSuppressedList('unsubscribed', defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.meta.total).toBe(2);
  });
});

describe('useBulkSuppress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /contacts/bulk-unsubscribe with emails', async () => {
    const { result } = renderHook(() => useBulkSuppress(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      emails: ['test@example.com'],
      block: false,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/contacts/bulk-unsubscribe', {
      emails: ['test@example.com'],
      allAccounts: true,
      block: false,
    });
  });

  it('shows success toast', async () => {
    const { result } = renderHook(() => useBulkSuppress(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      emails: ['test@example.com'],
      block: true,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows error toast on failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useBulkSuppress(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      emails: ['test@example.com'],
      block: false,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalled();
  });
});
