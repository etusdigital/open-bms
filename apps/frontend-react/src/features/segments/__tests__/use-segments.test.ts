// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import {
  useSegmentsList,
  useSegment,
  useCreateSegment,
  useUpdateSegment,
  useDeleteSegment,
  useCopySegment,
  useRunSegment,
} from '../use-segments';

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
          { id: 1, name: 'Active Users', type: 'segment', status: 'active', lastCount: 500 },
          { id: 2, name: 'New Leads', type: 'segment', status: 'inactive', lastCount: 0 },
        ],
        totalItems: 2,
        page: '1',
        itemsPerPage: '20',
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 3, name: 'New Segment' } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1, name: 'Updated' } }),
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

describe('useSegmentsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /tags with type=segment', async () => {
    const { result } = renderHook(() => useSegmentsList({ ...defaultParams, search: 'active' }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/tags', {
      params: expect.objectContaining({
        type: 'segment',
        title: 'active',
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('omits title param when search is empty', async () => {
    const { result } = renderHook(() => useSegmentsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const params = mockGet.mock.calls[0][1]?.params;
    expect(params).not.toHaveProperty('title');
    expect(params).toHaveProperty('type', 'segment');
  });

  it('returns segment data and meta', async () => {
    const { result } = renderHook(() => useSegmentsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.meta.total).toBe(2);
  });
});

describe('useSegment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /tags/:id', async () => {
    mockGet.mockResolvedValueOnce({
      data: { id: 5, name: 'Active Users', type: 'segment' },
    });

    const { result } = renderHook(() => useSegment(5), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/tags/5', {
      signal: expect.any(AbortSignal),
    });
  });

  it('does not fetch when id is 0', () => {
    const { result } = renderHook(() => useSegment(0), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateSegment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /tags/segment with form data', async () => {
    const { result } = renderHook(() => useCreateSegment(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      name: 'New Segment',
      description: '',
      contactsLimit: 0,
      recurrence: 24,
      addBounced: false,
      addUnsubscribed: false,
      addInvalid: false,
      isRealTimeSegment: false,
      steps: '[]',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith(
      '/tags/segment',
      expect.objectContaining({
        name: 'New Segment',
        type: 'segment',
      }),
    );
  });

  it('shows API error message on create failure', async () => {
    const { toast } = await import('sonner');

    const apiError = new AxiosError('Bad Request', '400', undefined, undefined, {
      status: 400,
      data: { status: 400, error: 'Segment name already exists' },
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    });
    mockPost.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useCreateSegment(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      name: 'Duplicate',
      description: '',
      contactsLimit: 0,
      recurrence: 24,
      addBounced: false,
      addUnsubscribed: false,
      addInvalid: false,
      isRealTimeSegment: false,
      steps: '[]',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Segment name already exists');
  });
});

describe('useUpdateSegment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls PUT /tags/segment/:id with form data', async () => {
    const { result } = renderHook(() => useUpdateSegment(5), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      name: 'Updated',
      description: 'New desc',
      contactsLimit: 100,
      recurrence: 48,
      addBounced: true,
      addUnsubscribed: false,
      addInvalid: false,
      isRealTimeSegment: false,
      steps: '[]',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith(
      '/tags/segment/5',
      expect.objectContaining({
        name: 'Updated',
        type: 'segment',
      }),
    );
  });
});

describe('useDeleteSegment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls DELETE /tags/:id', async () => {
    const { result } = renderHook(() => useDeleteSegment(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith('/tags/3');
  });
});

describe('useCopySegment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /tags/segment/:id/copy', async () => {
    const { result } = renderHook(() => useCopySegment(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(5);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/tags/segment/5/copy');
  });
});

describe('useRunSegment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /tags/segment/run/:id', async () => {
    mockGet.mockResolvedValueOnce({ data: { id: 5, isProcessing: true } });

    const { result } = renderHook(() => useRunSegment(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(5);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/tags/segment/run/5');
  });
});
