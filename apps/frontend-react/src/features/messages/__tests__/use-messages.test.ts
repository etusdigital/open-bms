// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import type { Message } from '../types';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: {
        results: [
          {
            id: 1,
            title: 'Welcome Email',
            type: 'email',
            subject: 'Welcome!',
            fromName: 'Test',
            fromMail: 'no-reply@test.com',
            status: 'draft',
            updatedAt: '2026-03-13T10:00:00Z',
          },
        ],
        totalItems: 1,
        page: 1,
        itemsPerPage: 10,
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 2, title: 'New Message' } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1, title: 'Updated' } }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

describe('useMessages hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  describe('useMessagesList', () => {
    it('calls GET /messages with type filter and pagination', async () => {
      const { useMessagesList } = await import('../use-messages');
      const { result } = renderHook(
        () => useMessagesList({ page: 1, pageSize: 10, search: '', sort: '', order: 'asc' }, 'email'),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/messages', {
        params: { page: 1, itemsPerPage: 10, type: 'email' },
        signal: expect.any(AbortSignal),
      });
    });

    it('includes search param when provided', async () => {
      const { useMessagesList } = await import('../use-messages');
      const { result } = renderHook(
        () => useMessagesList({ page: 1, pageSize: 10, search: 'welcome', sort: '', order: 'asc' }, 'email'),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/messages', {
        params: expect.objectContaining({ title: 'welcome', type: 'email' }),
        signal: expect.any(AbortSignal),
      });
    });

    it('includes sort params when provided', async () => {
      const { useMessagesList } = await import('../use-messages');
      const { result } = renderHook(
        () => useMessagesList({ page: 1, pageSize: 10, search: '', sort: 'updatedAt', order: 'desc' }, 'sms'),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/messages', {
        params: expect.objectContaining({ sortBy: 'updatedAt', order: 'desc', type: 'sms' }),
        signal: expect.any(AbortSignal),
      });
    });

    it('returns paginated data', async () => {
      const { useMessagesList } = await import('../use-messages');
      const { result } = renderHook(
        () => useMessagesList({ page: 1, pageSize: 10, search: '', sort: '', order: 'asc' }, 'email'),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toHaveLength(1);
      expect(result.current.data?.meta.total).toBe(1);
    });
  });

  describe('useMessage', () => {
    it('calls GET /messages/:id', async () => {
      mockGet.mockResolvedValueOnce({
        data: { id: 5, title: 'Test', type: 'email' } as Message,
      } as never);

      const { useMessage } = await import('../use-messages');
      const { result } = renderHook(() => useMessage(5), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith('/messages/5', { signal: expect.any(AbortSignal) });
    });
  });

  describe('useCreateMessage', () => {
    it('calls POST /messages and shows success toast', async () => {
      const { useCreateMessage } = await import('../use-messages');
      const { result } = renderHook(() => useCreateMessage(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate({
        title: 'New SMS',
        type: 'sms',
        content: 'Hello!',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockPost).toHaveBeenCalledWith('/messages', {
        title: 'New SMS',
        type: 'sms',
        content: 'Hello!',
      });
    });

    it('handles create error', async () => {
      mockPost.mockRejectedValueOnce(new Error('Server error'));

      const { useCreateMessage } = await import('../use-messages');
      const { result } = renderHook(() => useCreateMessage(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate({ title: 'Fail', type: 'sms' });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('useUpdateMessage', () => {
    it('calls PUT /messages/:id', async () => {
      const { useUpdateMessage } = await import('../use-messages');
      const { result } = renderHook(() => useUpdateMessage(1), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate({ title: 'Updated', type: 'email' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockPut).toHaveBeenCalledWith('/messages/1', { title: 'Updated', type: 'email' });
    });
  });

  describe('useDeleteMessage', () => {
    it('calls DELETE /messages/:id', async () => {
      const { useDeleteMessage } = await import('../use-messages');
      const { result } = renderHook(() => useDeleteMessage(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockDelete).toHaveBeenCalledWith('/messages/1');
    });

    it('handles delete error', async () => {
      mockDelete.mockRejectedValueOnce(new Error('Not found'));

      const { useDeleteMessage } = await import('../use-messages');
      const { result } = renderHook(() => useDeleteMessage(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate(999);

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('useDuplicateMessage', () => {
    it('calls POST /messages/:id/copy', async () => {
      const { useDuplicateMessage } = await import('../use-messages');
      const { result } = renderHook(() => useDuplicateMessage(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockPost).toHaveBeenCalledWith('/messages/1/copy');
    });
  });

  describe('usePoolsForSelect', () => {
    it('calls GET /pools with itemsPerPage=1000', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          results: [
            {
              id: 1,
              poolName: 'default-pool',
              senderEmail: 'sender@test.com',
              senderName: 'Sender',
              senderReplyTo: 'reply@test.com',
              isDefault: true,
            },
          ],
          totalItems: 1,
          page: 1,
          itemsPerPage: 1000,
        },
      } as never);

      const { usePoolsForSelect } = await import('../use-messages');
      const { result } = renderHook(() => usePoolsForSelect(), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith('/pools', {
        params: { page: 1, itemsPerPage: 1000 },
        signal: expect.any(AbortSignal),
      });
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].poolName).toBe('default-pool');
    });
  });

  describe('useSendTestEmail', () => {
    it('calls POST /services/send-email with payload', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } } as never);

      const { useSendTestEmail } = await import('../use-messages');
      const { result } = renderHook(() => useSendTestEmail(), {
        wrapper: createQueryWrapper(),
      });

      const payload = {
        contact: { email: 'test@test.com', firstName: 'Test' },
        message: {
          id: 1,
          title: 'Test Message',
          previewText: '',
          ippool: 'default-pool',
          subject: 'Subject',
          replyTo: '',
          priority: 'high' as const,
          content: '<p>Hello</p>',
          from: { firstName: 'Sender', email: 'sender@test.com' },
        },
        loadContactFromDatabase: true,
      };

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockPost).toHaveBeenCalledWith('/services/send-email', payload);
    });

    it('handles send test error', async () => {
      mockPost.mockRejectedValueOnce(new Error('Send failed'));

      const { useSendTestEmail } = await import('../use-messages');
      const { result } = renderHook(() => useSendTestEmail(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate({
        contact: { email: 'test@test.com', firstName: 'Test' },
        message: {
          id: 1,
          title: 'Test',
          previewText: '',
          ippool: '',
          subject: 'Test',
          replyTo: '',
          priority: 'high' as const,
          content: '',
          from: { firstName: '', email: '' },
        },
        loadContactFromDatabase: true,
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
