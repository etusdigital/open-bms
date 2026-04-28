// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import {
  useCampaignConfigsList,
  useCampaignConfig,
  useCreateCampaignConfig,
  useUpdateCampaignConfig,
  useDeleteCampaignConfig,
  useDuplicateCampaignConfig,
} from '../use-campaign-configs';

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
          { id: 1, name: 'Config A' },
          { id: 2, name: 'Config B' },
        ],
        totalItems: 2,
        page: '1',
        itemsPerPage: '20',
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 3, name: 'New Config' } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1, name: 'Updated Config' } }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

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

describe('useCampaignConfigsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /campaigns-rules/configs with correct params', async () => {
    const { result } = renderHook(() => useCampaignConfigsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/campaigns-rules/configs', {
      params: expect.objectContaining({
        page: 1,
        itemsPerPage: 20,
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('passes search as name param', async () => {
    renderHook(() => useCampaignConfigsList({ ...defaultParams, search: 'test' }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockGet).toHaveBeenCalledWith('/campaigns-rules/configs', {
      params: expect.objectContaining({ name: 'test' }),
      signal: expect.any(AbortSignal),
    });
  });

  it('returns paginated data', async () => {
    const { result } = renderHook(() => useCampaignConfigsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.meta.total).toBe(2);
  });
});

describe('useCampaignConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /campaigns-rules/configs/:id', async () => {
    mockGet.mockResolvedValueOnce({
      data: { id: 5, name: 'Config 5', description: 'Desc' },
    });

    const { result } = renderHook(() => useCampaignConfig(5), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/campaigns-rules/configs/5', {
      signal: expect.any(AbortSignal),
    });
  });

  it('does not fetch when id is 0', () => {
    const { result } = renderHook(() => useCampaignConfig(0), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateCampaignConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /campaigns-rules/configs', async () => {
    const { result } = renderHook(() => useCreateCampaignConfig(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'New Config', description: 'Desc' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/campaigns-rules/configs', {
      name: 'New Config',
      description: 'Desc',
    });
    expect(toast.success).toHaveBeenCalled();
  });
});

describe('useUpdateCampaignConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls PUT /campaigns-rules/configs/:id', async () => {
    const { result } = renderHook(() => useUpdateCampaignConfig(5), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ name: 'Updated', description: 'New desc' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith('/campaigns-rules/configs/5', {
      name: 'Updated',
      description: 'New desc',
    });
    expect(toast.success).toHaveBeenCalled();
  });
});

describe('useDeleteCampaignConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls DELETE /campaigns-rules/configs/:id', async () => {
    const { result } = renderHook(() => useDeleteCampaignConfig(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDelete).toHaveBeenCalledWith('/campaigns-rules/configs/3');
    expect(toast.success).toHaveBeenCalled();
  });
});

describe('useDuplicateCampaignConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /campaigns-rules/configs/:id/copy', async () => {
    const { result } = renderHook(() => useDuplicateCampaignConfig(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPost).toHaveBeenCalledWith('/campaigns-rules/configs/1/copy');
    expect(toast.success).toHaveBeenCalled();
  });
});
