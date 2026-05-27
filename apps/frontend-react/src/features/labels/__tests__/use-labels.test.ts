// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import { useLabelsList, useLabel, useCreateLabel, useUpdateLabel, useDeleteLabel } from '../use-labels';

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
          { id: 1, name: 'Label A' },
          { id: 2, name: 'Label B' },
        ],
        totalItems: 2,
        page: '1',
        itemsPerPage: '20',
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 3, name: 'New Label' } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1, name: 'Updated Label' } }),
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

describe('useLabelsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /labels with correct params', async () => {
    const { result } = renderHook(() => useLabelsList({ ...defaultParams, search: 'hello', page: 2 }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/labels', {
      params: expect.objectContaining({
        page: 2,
        itemsPerPage: 20,
        name: 'hello',
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('omits name param when search is empty', async () => {
    const { result } = renderHook(() => useLabelsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const params = mockGet.mock.calls[0][1]?.params;
    expect(params).not.toHaveProperty('name');
  });

  it('returns label data and meta', async () => {
    const { result } = renderHook(() => useLabelsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.meta.total).toBe(2);
  });
});

describe('useLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /labels/:id', async () => {
    mockGet.mockResolvedValueOnce({
      data: { id: 5, name: 'Label 5', description: 'Desc' },
    });

    const { result } = renderHook(() => useLabel(5), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/labels/5', {
      signal: expect.any(AbortSignal),
    });
    expect(result.current.data).toEqual({ id: 5, name: 'Label 5', description: 'Desc' });
  });

  it('does not fetch when id is 0', () => {
    const { result } = renderHook(() => useLabel(0), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalledWith('/labels/0', expect.anything());
  });
});

describe('useCreateLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /labels with form data', async () => {
    const { result } = renderHook(() => useCreateLabel(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'New Label', description: 'Desc' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/labels', {
      name: 'New Label',
      description: 'Desc',
    });
  });

  it('shows success toast on create', async () => {
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useCreateLabel(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'New Label', description: '' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalled();
  });

  it('shows API error message on create failure', async () => {
    const { toast } = await import('sonner');

    const apiError = new AxiosError('Bad Request', '400', undefined, undefined, {
      status: 400,
      data: { status: 400, error: 'Label name already exists' },
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    });
    mockPost.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useCreateLabel(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'Duplicate', description: '' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Label name already exists');
  });
});

describe('useUpdateLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls PUT /labels/:id with form data', async () => {
    const { result } = renderHook(() => useUpdateLabel(5), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'Updated', description: 'New desc' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith('/labels/5', {
      name: 'Updated',
      description: 'New desc',
    });
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

    const { result } = renderHook(() => useUpdateLabel(5), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'Fail', description: '' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Internal server error');
  });
});

describe('useDeleteLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls DELETE /labels/:id', async () => {
    const { result } = renderHook(() => useDeleteLabel(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith('/labels/3');
  });

  it('shows API error message on delete failure', async () => {
    const { toast } = await import('sonner');

    const apiError = new AxiosError('Conflict', '409', undefined, undefined, {
      status: 409,
      data: { status: 409, error: 'Cannot delete label in use' },
      statusText: 'Conflict',
      headers: {},
      config: {} as never,
    });
    mockDelete.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useDeleteLabel(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Cannot delete label in use');
  });
});
