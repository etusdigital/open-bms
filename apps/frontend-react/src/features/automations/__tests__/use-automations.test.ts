// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: {
        results: [
          {
            id: 1,
            title: 'Welcome Series',
            type: 'email',
            isActive: true,
            updatedAt: '2026-03-13T10:00:00Z',
          },
        ],
        totalItems: 1,
        page: 1,
        itemsPerPage: 10,
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 2, title: 'Copy' } }),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked(apiClient.patch);
const mockDelete = vi.mocked(apiClient.delete);

describe('useAutomations hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  describe('useAutomationsList', () => {
    it('calls GET /automations with type=email', async () => {
      const { useAutomationsList } = await import('../use-automations');
      const { result } = renderHook(
        () =>
          useAutomationsList({
            page: 1,
            pageSize: 10,
            search: '',
            sort: '',
            order: 'asc',
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/automations', {
        params: expect.objectContaining({ type: 'email' }),
        signal: expect.any(AbortSignal),
      });
    });

    it('includes search param when provided', async () => {
      const { useAutomationsList } = await import('../use-automations');
      const { result } = renderHook(
        () =>
          useAutomationsList({
            page: 1,
            pageSize: 10,
            search: 'welcome',
            sort: '',
            order: 'asc',
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/automations', {
        params: expect.objectContaining({ title: 'welcome' }),
        signal: expect.any(AbortSignal),
      });
    });

    it('returns paginated data', async () => {
      const { useAutomationsList } = await import('../use-automations');
      const { result } = renderHook(
        () =>
          useAutomationsList({
            page: 1,
            pageSize: 10,
            search: '',
            sort: '',
            order: 'asc',
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toHaveLength(1);
    });
  });

  describe('useDeleteAutomation', () => {
    it('calls DELETE /automations/:id', async () => {
      const { useDeleteAutomation } = await import('../use-automations');
      const { result } = renderHook(() => useDeleteAutomation(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockDelete).toHaveBeenCalledWith('/automations/1');
    });
  });

  describe('useDuplicateAutomation', () => {
    it('calls POST /automations/:id/copy', async () => {
      const { useDuplicateAutomation } = await import('../use-automations');
      const { result } = renderHook(() => useDuplicateAutomation(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockPost).toHaveBeenCalledWith('/automations/1/copy');
    });
  });

  describe('useToggleAutomation', () => {
    it('calls PATCH /automations/:id with isActive', async () => {
      const { useToggleAutomation } = await import('../use-automations');
      const { result } = renderHook(() => useToggleAutomation(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate({ id: 1, isActive: false });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockPatch).toHaveBeenCalledWith('/automations/1', { isActive: false });
    });
  });
});
