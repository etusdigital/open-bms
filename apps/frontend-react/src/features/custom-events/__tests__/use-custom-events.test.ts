// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import {
  useCustomEventsList,
  useCustomEvent,
  useCreateCustomEvent,
  useUpdateCustomEvent,
  useDeleteCustomEvent,
} from '../use-custom-events';

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
          { id: 1, name: 'page_view' },
          { id: 2, name: 'purchase' },
        ],
        totalItems: 2,
        page: '1',
        itemsPerPage: '20',
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 3, name: 'signup' } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1, name: 'updated_event' } }),
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

describe('useCustomEventsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /custom-events with correct params', async () => {
    const { result } = renderHook(() => useCustomEventsList({ ...defaultParams, search: 'page', page: 2 }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/custom-events', {
      params: expect.objectContaining({
        page: 2,
        itemsPerPage: 20,
        title: 'page',
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('omits title param when search is empty', async () => {
    const { result } = renderHook(() => useCustomEventsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const params = mockGet.mock.calls[0][1]?.params;
    expect(params).not.toHaveProperty('title');
  });

  it('returns event data and meta', async () => {
    const { result } = renderHook(() => useCustomEventsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.meta.total).toBe(2);
  });
});

describe('useCustomEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /custom-events/:id', async () => {
    mockGet.mockResolvedValueOnce({
      data: { id: 5, name: 'page_view', description: 'Desc' },
    });

    const { result } = renderHook(() => useCustomEvent(5), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/custom-events/5', {
      signal: expect.any(AbortSignal),
    });
  });

  it('does not fetch when id is 0', () => {
    const { result } = renderHook(() => useCustomEvent(0), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateCustomEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /custom-events with form data', async () => {
    const { result } = renderHook(() => useCreateCustomEvent(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'signup', description: 'User signed up' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/custom-events', {
      name: 'signup',
      description: 'User signed up',
    });
  });

  it('shows API error message on create failure', async () => {
    const { toast } = await import('sonner');

    const apiError = new AxiosError('Bad Request', '400', undefined, undefined, {
      status: 400,
      data: { status: 400, error: 'Event name already exists' },
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    });
    mockPost.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useCreateCustomEvent(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'Duplicate', description: '' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Event name already exists');
  });
});

describe('useUpdateCustomEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls PUT /custom-events/:id with form data', async () => {
    const { result } = renderHook(() => useUpdateCustomEvent(5), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'Updated', description: 'New desc' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith('/custom-events/5', {
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

    const { result } = renderHook(() => useUpdateCustomEvent(5), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'Fail', description: '' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Internal server error');
  });
});

describe('useDeleteCustomEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls DELETE /custom-events/:id', async () => {
    const { result } = renderHook(() => useDeleteCustomEvent(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith('/custom-events/3');
  });

  it('shows API error message on delete failure', async () => {
    const { toast } = await import('sonner');

    const apiError = new AxiosError('Conflict', '409', undefined, undefined, {
      status: 409,
      data: { status: 409, error: 'Cannot delete default event' },
      statusText: 'Conflict',
      headers: {},
      config: {} as never,
    });
    mockDelete.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useDeleteCustomEvent(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Cannot delete default event');
  });
});
