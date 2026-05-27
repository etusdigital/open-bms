// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import {
  useCustomFieldsList,
  useCustomField,
  useCreateCustomField,
  useUpdateCustomField,
  useDeleteCustomField,
} from '../use-custom-fields';

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
          { id: 1, title: 'Color', name: 'color', type: 'text' },
          { id: 2, title: 'Size', name: 'size', type: 'number' },
        ],
        totalItems: 2,
        page: '1',
        itemsPerPage: '20',
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 3, title: 'New Field', name: 'new_field' } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1, title: 'Updated Field' } }),
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

describe('useCustomFieldsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /custom-fields with correct params', async () => {
    const { result } = renderHook(() => useCustomFieldsList({ ...defaultParams, search: 'color', page: 2 }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/custom-fields', {
      params: expect.objectContaining({
        page: 2,
        itemsPerPage: 20,
        title: 'color',
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('omits title param when search is empty', async () => {
    const { result } = renderHook(() => useCustomFieldsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const params = mockGet.mock.calls[0][1]?.params;
    expect(params).not.toHaveProperty('title');
  });

  it('returns custom field data and meta', async () => {
    const { result } = renderHook(() => useCustomFieldsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.meta.total).toBe(2);
  });
});

describe('useCustomField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /custom-fields/:id', async () => {
    mockGet.mockResolvedValueOnce({
      data: { id: 5, title: 'Birthday', name: 'birthday', type: 'date' },
    });

    const { result } = renderHook(() => useCustomField(5), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/custom-fields/5', {
      signal: expect.any(AbortSignal),
    });
    expect(result.current.data).toEqual({
      id: 5,
      title: 'Birthday',
      name: 'birthday',
      type: 'date',
    });
  });

  it('does not fetch when id is 0', () => {
    const { result } = renderHook(() => useCustomField(0), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalledWith('/custom-fields/0', expect.anything());
  });
});

describe('useCreateCustomField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /custom-fields with form data', async () => {
    const { result } = renderHook(() => useCreateCustomField(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ title: 'New Field', description: 'Desc', type: 'text' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/custom-fields', {
      title: 'New Field',
      description: 'Desc',
      type: 'text',
    });
  });

  it('shows success toast on create', async () => {
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useCreateCustomField(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ title: 'New Field', description: '', type: 'text' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalled();
  });

  it('shows API error message on create failure', async () => {
    const { toast } = await import('sonner');

    const apiError = new AxiosError('Bad Request', '400', undefined, undefined, {
      status: 400,
      data: { status: 400, error: 'Custom field name already exists' },
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    });
    mockPost.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useCreateCustomField(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ title: 'Duplicate', description: '', type: 'text' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Custom field name already exists');
  });
});

describe('useUpdateCustomField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls PUT /custom-fields/:id with form data', async () => {
    const { result } = renderHook(() => useUpdateCustomField(7), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ title: 'Updated', description: 'New desc', type: 'number' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith('/custom-fields/7', {
      title: 'Updated',
      description: 'New desc',
      type: 'number',
    });
  });

  it('shows success toast on update', async () => {
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useUpdateCustomField(7), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ title: 'Updated', description: '', type: 'text' });

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

    const { result } = renderHook(() => useUpdateCustomField(7), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ title: 'Fail', description: '', type: 'text' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Internal server error');
  });
});

describe('useDeleteCustomField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls DELETE /custom-fields/:id', async () => {
    const { result } = renderHook(() => useDeleteCustomField(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(42);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith('/custom-fields/42');
  });

  it('shows API error message on delete failure', async () => {
    const { toast } = await import('sonner');

    const apiError = new AxiosError('Conflict', '409', undefined, undefined, {
      status: 409,
      data: { status: 409, error: 'Custom field is in use by contacts' },
      statusText: 'Conflict',
      headers: {},
      config: {} as never,
    });
    mockDelete.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useDeleteCustomField(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(42);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Custom field is in use by contacts');
  });
});
