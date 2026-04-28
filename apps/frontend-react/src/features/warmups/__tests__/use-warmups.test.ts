// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import { useWarmupsList, useWarmup, useCreateWarmup, useUpdateWarmup, useDeleteWarmup } from '../use-warmups';

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
          { id: 1, sender: 'a@b.com', status: 'running', target: 1000 },
          { id: 2, sender: 'c@d.com', status: 'notStarted', target: 5000 },
        ],
        totalItems: 2,
        page: '1',
        itemsPerPage: '20',
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 3, sender: 'new@test.com' } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1, sender: 'updated@test.com' } }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const defaultParams = {
  page: 1,
  pageSize: 20,
  search: '',
  sort: '',
  order: 'asc' as const,
};

describe('useWarmupsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /warmups with correct params', async () => {
    const { result } = renderHook(() => useWarmupsList({ ...defaultParams, search: 'test', page: 2 }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/warmups', {
      params: expect.objectContaining({
        page: 2,
        itemsPerPage: 20,
        name: 'test',
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('omits sender param when search is empty', async () => {
    const { result } = renderHook(() => useWarmupsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const params = mockGet.mock.calls[0][1]?.params;
    expect(params).not.toHaveProperty('sender');
  });

  it('returns warmup data and meta', async () => {
    const { result } = renderHook(() => useWarmupsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.meta.total).toBe(2);
  });
});

describe('useWarmup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /warmups/:id', async () => {
    mockGet.mockResolvedValueOnce({
      data: { id: 5, sender: 'a@b.com', status: 'running' },
    });

    const { result } = renderHook(() => useWarmup(5), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/warmups/5', {
      signal: expect.any(AbortSignal),
    });
  });

  it('does not fetch when id is 0', () => {
    const { result } = renderHook(() => useWarmup(0), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateWarmup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /warmups with form data', async () => {
    const { result } = renderHook(() => useCreateWarmup(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      accountId: 1,
      targetAccountId: 2,
      sender: 'test@example.com',
      ippool: 'main-pool',
      replyTo: '',
      target: 1000,
      type: 'internal',
      stage: 1,
      description: '',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith(
      '/warmups',
      expect.objectContaining({
        sender: 'test@example.com',
        target: 1000,
      }),
    );
  });

  it('shows API error message on create failure', async () => {
    const { toast } = await import('sonner');

    const apiError = new AxiosError('Bad Request', '400', undefined, undefined, {
      status: 400,
      data: { status: 400, error: 'Warmup already exists for this pool' },
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    });
    mockPost.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useCreateWarmup(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      accountId: 1,
      targetAccountId: 2,
      sender: 'dup@test.com',
      ippool: 'dup',
      replyTo: '',
      target: 1000,
      type: 'internal',
      stage: 1,
      description: '',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Warmup already exists for this pool');
  });
});

describe('useUpdateWarmup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls PUT /warmups/:id with form data', async () => {
    const { result } = renderHook(() => useUpdateWarmup(5), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      accountId: 1,
      targetAccountId: 2,
      sender: 'updated@test.com',
      ippool: 'updated',
      replyTo: '',
      target: 5000,
      type: 'external',
      stage: null,
      description: '',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith(
      '/warmups/5',
      expect.objectContaining({
        sender: 'updated@test.com',
      }),
    );
  });
});

describe('useDeleteWarmup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls DELETE /warmups/:id', async () => {
    const { result } = renderHook(() => useDeleteWarmup(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith('/warmups/3');
  });

  it('shows API error message on delete failure', async () => {
    const { toast } = await import('sonner');

    const apiError = new AxiosError('Conflict', '409', undefined, undefined, {
      status: 409,
      data: { status: 409, error: 'Cannot delete running warmup' },
      statusText: 'Conflict',
      headers: {},
      config: {} as never,
    });
    mockDelete.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useDeleteWarmup(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Cannot delete running warmup');
  });
});
