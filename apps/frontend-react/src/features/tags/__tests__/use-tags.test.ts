// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import { useTagsList, useTag, useCreateTag, useUpdateTag, useDeleteTag } from '../use-tags';

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
          { id: 1, name: 'Tag 1', type: 'manual' },
          { id: 2, name: 'Tag 2', type: 'auto' },
        ],
        totalItems: 2,
        page: '1',
        itemsPerPage: '20',
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 3, name: 'New Tag' } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1, name: 'Updated Tag' } }),
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

describe('useTagsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /tags with correct params', async () => {
    const { result } = renderHook(() => useTagsList({ ...defaultParams, search: 'hello', page: 2 }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/tags', {
      params: expect.objectContaining({
        page: 2,
        itemsPerPage: 20,
        title: 'hello',
        type: 'tag',
        withCount: true,
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('omits title param when search is empty', async () => {
    const { result } = renderHook(() => useTagsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const params = mockGet.mock.calls[0][1]?.params;
    expect(params).not.toHaveProperty('title');
  });

  it('returns tag data and meta', async () => {
    const { result } = renderHook(() => useTagsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.meta.total).toBe(2);
  });
});

describe('useDeleteTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls DELETE /tags/:id', async () => {
    const { result } = renderHook(() => useDeleteTag(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(42);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith('/tags/42');
  });

  it('shows API error message on delete failure', async () => {
    const { toast } = await import('sonner');

    const apiError = new AxiosError('Conflict', '409', undefined, undefined, {
      status: 409,
      data: {
        status: 409,
        error: 'A tag não pode ser apagada por estar sendo usada em: campanhas',
      },
      statusText: 'Conflict',
      headers: {},
      config: {} as never,
    });
    mockDelete.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useDeleteTag(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(42);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('A tag não pode ser apagada por estar sendo usada em: campanhas');
  });
});

describe('useTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /tags/:id', async () => {
    mockGet.mockResolvedValueOnce({
      data: { id: 5, name: 'Tag 5', type: 'tag' },
    });

    const { result } = renderHook(() => useTag(5), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/tags/5', {
      signal: expect.any(AbortSignal),
    });
    expect(result.current.data).toEqual({ id: 5, name: 'Tag 5', type: 'tag' });
  });

  it('does not fetch when id is 0', () => {
    const { result } = renderHook(() => useTag(0), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalledWith('/tags/0', expect.anything());
  });
});

describe('useCreateTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /tags with form data', async () => {
    const { result } = renderHook(() => useCreateTag(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'New Tag', description: 'Desc' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/tags', {
      name: 'New Tag',
      description: 'Desc',
    });
  });

  it('shows success toast on create', async () => {
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useCreateTag(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'New Tag', description: '' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalled();
  });

  it('shows API error message on create failure', async () => {
    const { toast } = await import('sonner');

    const apiError = new AxiosError('Bad Request', '400', undefined, undefined, {
      status: 400,
      data: { status: 400, error: 'Tag name already exists' },
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    });
    mockPost.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useCreateTag(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'Duplicate', description: '' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Tag name already exists');
  });
});

describe('useUpdateTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls PUT /tags/:id with form data', async () => {
    const { result } = renderHook(() => useUpdateTag(7), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'Updated', description: 'New desc' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith('/tags/7', {
      name: 'Updated',
      description: 'New desc',
    });
  });

  it('shows success toast on update', async () => {
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useUpdateTag(7), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'Updated', description: '' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalled();
  });

  it('shows API error message on update failure', async () => {
    const { toast } = await import('sonner');

    const apiError = new AxiosError('Server Error', '500', undefined, undefined, {
      status: 500,
      data: { status: 500, error: 'Internal server error' },
      statusText: 'Server Error',
      headers: {},
      config: {} as never,
    });
    mockPut.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useUpdateTag(7), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'Fail', description: '' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Internal server error');
  });
});
