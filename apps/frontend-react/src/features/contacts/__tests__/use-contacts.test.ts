// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import { useContactsList, useContact, useContactDashboard, useUpdateContact, useDeleteContact } from '../use-contacts';

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
          { id: 1, email: 'john@example.com', firstName: 'John', isActive: true },
          { id: 2, email: 'jane@example.com', firstName: 'Jane', isActive: false },
        ],
        totalItems: 2,
        page: '1',
        itemsPerPage: '20',
      },
    }),
    put: vi.fn().mockResolvedValue({ data: { id: 1, email: 'john@example.com' } }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const defaultParams = {
  page: 1,
  pageSize: 20,
  search: '',
  sort: '',
  order: 'asc' as const,
};

describe('useContactsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /contacts with search as title param', async () => {
    const { result } = renderHook(() => useContactsList({ ...defaultParams, search: 'john' }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/contacts', {
      params: expect.objectContaining({
        title: 'john',
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('omits title param when search is empty', async () => {
    const { result } = renderHook(() => useContactsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const params = mockGet.mock.calls[0][1]?.params;
    expect(params).not.toHaveProperty('title');
  });

  it('returns contact data and meta', async () => {
    const { result } = renderHook(() => useContactsList(defaultParams), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.meta.total).toBe(2);
  });
});

describe('useContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /contacts/:id', async () => {
    mockGet.mockResolvedValueOnce({
      data: { id: 5, email: 'john@example.com', firstName: 'John' },
    });

    const { result } = renderHook(() => useContact('abc-uuid-123'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/contacts/abc-uuid-123', {
      signal: expect.any(AbortSignal),
    });
  });

  it('does not fetch when id is 0', () => {
    const { result } = renderHook(() => useContact(''), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useContactDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /contacts/dashboard', async () => {
    mockGet.mockResolvedValueOnce({
      data: { total: 1000, subscribedToday: 5, active: 800, providers: {} },
    });

    const { result } = renderHook(() => useContactDashboard(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/contacts/dashboard', {
      signal: expect.any(AbortSignal),
    });
  });
});

describe('useUpdateContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls PUT /contact with form data', async () => {
    const { result } = renderHook(() => useUpdateContact('abc-uuid-123'), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '',
      city: '',
      region: '',
      country: '',
      isActive: true,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPut).toHaveBeenCalledWith(
      '/contact',
      expect.objectContaining({
        uuid: 'abc-uuid-123',
        firstName: 'John',
      }),
    );
  });
});

describe('useDeleteContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls DELETE /contacts/:id', async () => {
    const { result } = renderHook(() => useDeleteContact(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith('/contacts/3');
  });
});
