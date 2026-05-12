// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import { useImportContacts } from '../use-contacts';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockPost = vi.mocked(apiClient.post);

const basePayload = {
  contacts: [
    ['john@example.com', 'John', 'Doe'],
    ['jane@example.com', 'Jane', 'Smith'],
  ],
  headers: {
    0: { type: 'contacts' as const, value: 'email' },
    1: { type: 'contacts' as const, value: 'firstName' },
    2: { type: 'contacts' as const, value: 'lastName' },
  },
  tags: ['newsletter'],
  actions: {
    contactUpdate: true,
    startAutomation: false,
  },
};

describe('useImportContacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls POST /contacts/import with payload', async () => {
    const { result } = renderHook(() => useImportContacts(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(basePayload);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/contacts/import', basePayload);
  });

  it('shows success toast on success', async () => {
    const { result } = renderHook(() => useImportContacts(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(basePayload);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalled();
  });

  it('shows error toast on failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Server error'));

    const { result } = renderHook(() => useImportContacts(), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(basePayload);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalled();
  });
});
