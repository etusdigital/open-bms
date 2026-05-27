// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import {
  useTagOptions,
  useSegmentOptions,
  useBulkAddTags,
  useBulkRemoveTags,
  useBulkUnsubscribe,
} from '../use-contact-tags';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

import { toast } from 'sonner';

describe('useTagOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockGet.mockResolvedValue({
      data: {
        results: [
          { id: 1, name: 'VIP', type: 'tag' },
          { id: 2, name: 'Premium', type: 'tag' },
        ],
      },
    });
  });

  it('fetches tags and maps to { value, label } options', async () => {
    const { result } = renderHook(() => useTagOptions(true), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      '/tags',
      expect.objectContaining({
        params: { type: 'tag', itemsPerPage: 40 },
      }),
    );
    expect(result.current.data).toEqual([
      { value: '1', label: 'VIP' },
      { value: '2', label: 'Premium' },
    ]);
  });

  it('does not fetch when disabled', () => {
    renderHook(() => useTagOptions(false), {
      wrapper: createQueryWrapper(),
    });

    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('useSegmentOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockGet.mockResolvedValue({
      data: {
        results: [{ id: 10, name: 'Engaged Users', type: 'segment' }],
      },
    });
  });

  it('fetches segments with type=segment', async () => {
    const { result } = renderHook(() => useSegmentOptions(true), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      '/tags',
      expect.objectContaining({
        params: { type: 'segment', itemsPerPage: 40 },
      }),
    );
    expect(result.current.data).toEqual([{ value: '10', label: 'Engaged Users' }]);
  });
});

describe('useBulkAddTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockPost.mockResolvedValue({ data: {} });
  });

  it('calls POST /contacts/tags with action add', async () => {
    const { result } = renderHook(() => useBulkAddTags(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ contactIds: [1, 2], tagIds: [10, 20] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/contacts/tags', {
      contacts: [1, 2],
      tags: [10, 20],
      action: 'add',
    });
  });

  it('shows success toast', async () => {
    const { result } = renderHook(() => useBulkAddTags(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ contactIds: [1], tagIds: [10] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalled();
  });

  it('shows error toast on failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useBulkAddTags(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ contactIds: [1], tagIds: [10] });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalled();
  });
});

describe('useBulkRemoveTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockPost.mockResolvedValue({ data: {} });
  });

  it('calls POST /contacts/tags with action remove', async () => {
    const { result } = renderHook(() => useBulkRemoveTags(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ contactIds: [1], tagIds: [10] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/contacts/tags', {
      contacts: [1],
      tags: [10],
      action: 'remove',
    });
  });

  it('shows success toast', async () => {
    const { result } = renderHook(() => useBulkRemoveTags(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ contactIds: [1], tagIds: [10] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalled();
  });
});

describe('useBulkUnsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockPost.mockResolvedValue({ data: {} });
  });

  it('calls POST /contacts/bulk-unsubscribe with emails', async () => {
    const { result } = renderHook(() => useBulkUnsubscribe(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ emails: ['a@b.com', 'c@d.com'] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/contacts/bulk-unsubscribe', {
      emails: ['a@b.com', 'c@d.com'],
      allAccounts: true,
      block: false,
    });
  });

  it('shows success toast', async () => {
    const { result } = renderHook(() => useBulkUnsubscribe(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ emails: ['a@b.com'] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalled();
  });

  it('shows error toast on failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useBulkUnsubscribe(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate({ emails: ['a@b.com'] });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalled();
  });
});
