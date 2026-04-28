// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import {
  useCampaignRulesList,
  useCampaignRule,
  useCreateCampaignRule,
  useUpdateCampaignRule,
  useDeleteCampaignRule,
} from '../use-campaign-rules';

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
          { id: 1, name: 'Rule A', weekDays: [1, 2, 3] },
          { id: 2, name: 'Rule B', weekDays: [4, 5] },
        ],
        totalItems: 2,
        page: '1',
        itemsPerPage: '20',
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 3, name: 'New Rule' } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1, name: 'Updated Rule' } }),
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

describe('useCampaignRulesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /campaigns-rules/rules with correct params', async () => {
    const { result } = renderHook(() => useCampaignRulesList({ ...defaultParams, search: 'test' }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/campaigns-rules/rules', {
      params: expect.objectContaining({
        page: 1,
        itemsPerPage: 20,
        name: 'test',
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('omits name param when search is empty', async () => {
    const { result } = renderHook(() => useCampaignRulesList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const params = mockGet.mock.calls[0][1]?.params;
    expect(params).not.toHaveProperty('name');
  });

  it('returns paginated data', async () => {
    const { result } = renderHook(() => useCampaignRulesList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.meta.total).toBe(2);
  });
});

describe('useCampaignRule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /campaigns-rules/rules/:id', async () => {
    mockGet.mockResolvedValueOnce({
      data: { id: 5, name: 'Rule 5', weekDays: [1, 3, 5] },
    });

    const { result } = renderHook(() => useCampaignRule(5), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/campaigns-rules/rules/5', {
      signal: expect.any(AbortSignal),
    });
  });

  it('does not fetch when id is 0', () => {
    const { result } = renderHook(() => useCampaignRule(0), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateCampaignRule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /campaigns-rules/rules', async () => {
    const { result } = renderHook(() => useCreateCampaignRule(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      name: 'New Rule',
      description: 'Desc',
      weekDays: [1, 2],
      configIds: [],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/campaigns-rules/rules', expect.objectContaining({ name: 'New Rule' }));
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows API error message on failure', async () => {
    const apiError = new AxiosError('Bad Request', '400', undefined, undefined, {
      status: 400,
      data: { status: 400, error: 'Rule name already exists' },
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    });
    mockPost.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useCreateCampaignRule(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      name: 'Dup',
      description: 'Desc',
      weekDays: [],
      configIds: [],
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Rule name already exists');
  });
});

describe('useUpdateCampaignRule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls PUT /campaigns-rules/rules/:id', async () => {
    const { result } = renderHook(() => useUpdateCampaignRule(5), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      name: 'Updated',
      description: 'New desc',
      weekDays: [1],
      configIds: [],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith('/campaigns-rules/rules/5', expect.objectContaining({ name: 'Updated' }));
    expect(toast.success).toHaveBeenCalled();
  });
});

describe('useDeleteCampaignRule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls DELETE /campaigns-rules/rules/:id', async () => {
    const { result } = renderHook(() => useDeleteCampaignRule(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDelete).toHaveBeenCalledWith('/campaigns-rules/rules/3');
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows API error on delete failure', async () => {
    const apiError = new AxiosError('Conflict', '409', undefined, undefined, {
      status: 409,
      data: { status: 409, error: 'Cannot delete rule in use' },
      statusText: 'Conflict',
      headers: {},
      config: {} as never,
    });
    mockDelete.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useDeleteCampaignRule(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Cannot delete rule in use');
  });
});
