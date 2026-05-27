import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import {
  useTemplatesList,
  useTemplate,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useDuplicateTemplate,
} from '../use-templates';

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
          { id: 1, name: 'Welcome Email', updatedAt: '2026-01-15' },
          { id: 2, name: 'Newsletter', updatedAt: '2026-01-16' },
        ],
        totalItems: 2,
        page: '1',
        itemsPerPage: '20',
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 3, name: 'New Template' } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1, name: 'Updated Template' } }),
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

describe('useTemplatesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /email-template with params', async () => {
    const { result } = renderHook(() => useTemplatesList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      '/email-template',
      expect.objectContaining({
        params: expect.objectContaining({ page: 1, itemsPerPage: 20 }),
      }),
    );
  });

  it('passes search as name param', async () => {
    const params = { ...defaultParams, search: 'welcome' };
    renderHook(() => useTemplatesList(params), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith(
      '/email-template',
      expect.objectContaining({
        params: expect.objectContaining({ name: 'welcome' }),
      }),
    );
  });

  it('returns paginated data', async () => {
    const { result } = renderHook(() => useTemplatesList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.meta.total).toBe(2);
  });
});

describe('useTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockGet.mockResolvedValue({
      data: { id: 1, name: 'Welcome Email', html_template: '<p>Hello</p>' },
    });
  });

  it('calls GET /email-template/:id', async () => {
    const { result } = renderHook(() => useTemplate(1), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith('/email-template/1', expect.any(Object));
  });
});

describe('useCreateTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /email-template', async () => {
    const { result } = renderHook(() => useCreateTemplate(), { wrapper: createQueryWrapper() });

    result.current.mutate({ name: 'New', description: '', html_template: '', json_template: '' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPost).toHaveBeenCalledWith('/email-template', expect.objectContaining({ name: 'New' }));
    expect(toast.success).toHaveBeenCalled();
  });
});

describe('useUpdateTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls PUT /email-template/:id', async () => {
    const { result } = renderHook(() => useUpdateTemplate(1), { wrapper: createQueryWrapper() });

    result.current.mutate({
      name: 'Updated',
      description: '',
      html_template: '',
      json_template: '',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPut).toHaveBeenCalledWith('/email-template/1', expect.objectContaining({ name: 'Updated' }));
    expect(toast.success).toHaveBeenCalled();
  });
});

describe('useDeleteTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls DELETE /email-template/:id', async () => {
    const { result } = renderHook(() => useDeleteTemplate(), { wrapper: createQueryWrapper() });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDelete).toHaveBeenCalledWith('/email-template/1');
    expect(toast.success).toHaveBeenCalled();
  });
});

describe('useDuplicateTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /email-template/:id/copy', async () => {
    const { result } = renderHook(() => useDuplicateTemplate(), { wrapper: createQueryWrapper() });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPost).toHaveBeenCalledWith('/email-template/1/copy');
    expect(toast.success).toHaveBeenCalled();
  });
});
