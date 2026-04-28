// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import {
  usePoolsList,
  usePool,
  useSendGridPools,
  useSendGridIps,
  useCreatePool,
  useUpdatePool,
  useDeletePool,
} from '../use-pools';

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
          { id: 1, name: 'Main Pool', poolName: 'main-pool' },
          { id: 2, name: 'Secondary Pool', poolName: 'secondary' },
        ],
        totalItems: 2,
        page: '1',
        itemsPerPage: '20',
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 3, name: 'New Pool' } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1, name: 'Updated Pool' } }),
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

describe('usePoolsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /pools with correct params', async () => {
    const { result } = renderHook(() => usePoolsList({ ...defaultParams, search: 'main', page: 2 }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/pools', {
      params: expect.objectContaining({
        page: 2,
        itemsPerPage: 20,
        name: 'main',
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('omits name param when search is empty', async () => {
    const { result } = renderHook(() => usePoolsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const params = mockGet.mock.calls[0][1]?.params;
    expect(params).not.toHaveProperty('name');
  });

  it('returns pool data and meta', async () => {
    const { result } = renderHook(() => usePoolsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.meta.total).toBe(2);
  });
});

describe('usePool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /pools/:id', async () => {
    mockGet.mockResolvedValueOnce({
      data: { id: 5, name: 'Main Pool', poolName: 'main-pool' },
    });

    const { result } = renderHook(() => usePool(5), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/pools/5', {
      signal: expect.any(AbortSignal),
    });
  });

  it('does not fetch when id is 0', () => {
    const { result } = renderHook(() => usePool(0), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useSendGridPools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /pools/sendgrid', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ name: 'pool-1' }, { name: 'pool-2' }],
    });

    const { result } = renderHook(() => useSendGridPools(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/pools/sendgrid', {
      signal: expect.any(AbortSignal),
    });
  });
});

describe('useSendGridIps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /pools/ips/sendgrid/:poolName', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ ip: '1.2.3.4', pools: ['main'] }],
    });

    const { result } = renderHook(() => useSendGridIps('main'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/pools/ips/sendgrid/main', {
      signal: expect.any(AbortSignal),
    });
  });

  it('does not fetch when poolName is empty', () => {
    const { result } = renderHook(() => useSendGridIps(''), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreatePool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /pools with form data', async () => {
    const { result } = renderHook(() => useCreatePool(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      name: 'New Pool',
      description: 'A pool',
      poolName: 'new-pool',
      senderEmail: 'test@example.com',
      senderName: 'Test',
      senderReplyTo: '',
      isDefault: false,
      ip: '',
      dailyLimit: '0',
      sendingLimit: '0',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith(
      '/pools',
      expect.objectContaining({
        name: 'New Pool',
        poolName: 'new-pool',
      }),
    );
  });

  it('shows API error message on create failure', async () => {
    const { toast } = await import('sonner');

    const apiError = new AxiosError('Bad Request', '400', undefined, undefined, {
      status: 400,
      data: { status: 400, error: 'Pool name already exists' },
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    });
    mockPost.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useCreatePool(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      name: 'Duplicate',
      description: '',
      poolName: 'dup',
      senderEmail: '',
      senderName: '',
      senderReplyTo: '',
      isDefault: false,
      ip: '',
      dailyLimit: '0',
      sendingLimit: '0',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Pool name already exists');
  });
});

describe('useUpdatePool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls PUT /pools/:id with form data', async () => {
    const { result } = renderHook(() => useUpdatePool(5), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      name: 'Updated',
      description: 'New desc',
      poolName: 'updated',
      senderEmail: '',
      senderName: '',
      senderReplyTo: '',
      isDefault: false,
      ip: '',
      dailyLimit: '0',
      sendingLimit: '0',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith(
      '/pools/5',
      expect.objectContaining({
        name: 'Updated',
      }),
    );
  });
});

describe('useDeletePool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls DELETE /pools/:id', async () => {
    const { result } = renderHook(() => useDeletePool(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith('/pools/3');
  });

  it('shows API error message on delete failure', async () => {
    const { toast } = await import('sonner');

    const apiError = new AxiosError('Conflict', '409', undefined, undefined, {
      status: 409,
      data: { status: 409, error: 'Cannot delete default pool' },
      statusText: 'Conflict',
      headers: {},
      config: {} as never,
    });
    mockDelete.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useDeletePool(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Cannot delete default pool');
  });
});
