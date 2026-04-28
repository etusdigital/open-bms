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
            title: '2FA Email Code',
            type: '2FA-email',
            updatedAt: '2026-03-13T10:00:00Z',
          },
        ],
        totalItems: 1,
        page: 1,
        itemsPerPage: 10,
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 2, title: 'Copied' } }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockDelete = vi.mocked(apiClient.delete);

describe('useTwoFAMessages hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  describe('useTwoFAMessagesList', () => {
    it('calls GET /messages with type=2FA-email', async () => {
      const { useTwoFAMessagesList } = await import('../use-twofa-messages');
      const { result } = renderHook(
        () => useTwoFAMessagesList({ page: 1, pageSize: 10, search: '', sort: '', order: 'asc' }, 'email'),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/messages', {
        params: expect.objectContaining({ type: '2FA-email' }),
        signal: expect.any(AbortSignal),
      });
    });

    it('calls GET /messages with type=2FA-sms for sms channel', async () => {
      const { useTwoFAMessagesList } = await import('../use-twofa-messages');
      const { result } = renderHook(
        () => useTwoFAMessagesList({ page: 1, pageSize: 10, search: '', sort: '', order: 'asc' }, 'sms'),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/messages', {
        params: expect.objectContaining({ type: '2FA-sms' }),
        signal: expect.any(AbortSignal),
      });
    });

    it('includes search param when provided', async () => {
      const { useTwoFAMessagesList } = await import('../use-twofa-messages');
      const { result } = renderHook(
        () => useTwoFAMessagesList({ page: 1, pageSize: 10, search: 'code', sort: '', order: 'asc' }, 'email'),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/messages', {
        params: expect.objectContaining({ title: 'code' }),
        signal: expect.any(AbortSignal),
      });
    });

    it('returns paginated data', async () => {
      const { useTwoFAMessagesList } = await import('../use-twofa-messages');
      const { result } = renderHook(
        () => useTwoFAMessagesList({ page: 1, pageSize: 10, search: '', sort: '', order: 'asc' }, 'email'),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toHaveLength(1);
    });
  });

  describe('useDeleteTwoFAMessage', () => {
    it('calls DELETE /messages/:id', async () => {
      const { useDeleteTwoFAMessage } = await import('../use-twofa-messages');
      const { result } = renderHook(() => useDeleteTwoFAMessage(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockDelete).toHaveBeenCalledWith('/messages/1');
    });
  });

  describe('useDuplicateTwoFAMessage', () => {
    it('calls POST /messages/:id/copy', async () => {
      const { useDuplicateTwoFAMessage } = await import('../use-twofa-messages');
      const { result } = renderHook(() => useDuplicateTwoFAMessage(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockPost).toHaveBeenCalledWith('/messages/1/copy');
    });
  });

  describe('useTwoFAStatistics', () => {
    it('calls GET /verify/statistics with correct params', async () => {
      mockGet.mockResolvedValueOnce({
        data: [
          {
            date: '2026-04-01',
            method: 'EMAIL',
            group: 'default',
            count_total: 100,
            count_success: 95,
            count_error: 5,
            count_verify_validated: 80,
            count_verify_rejected: 10,
          },
        ],
      });

      const { useTwoFAStatistics } = await import('../use-twofa-messages');
      const { result } = renderHook(() => useTwoFAStatistics('email', ['default'], '2026-04-01', '2026-04-07'), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/verify/statistics', {
        params: {
          startDate: '2026-04-01',
          endDate: '2026-04-07',
          method: 'EMAIL',
          group: ['default'],
        },
        signal: expect.any(AbortSignal),
      });
    });

    it('normalizes snake_case response to camelCase', async () => {
      mockGet.mockResolvedValueOnce({
        data: [
          {
            date: '2026-04-01',
            method: 'EMAIL',
            group: 'default',
            count_total: '100',
            count_success: '95',
            count_error: '5',
            count_verify_validated: '80',
            count_verify_rejected: '10',
          },
        ],
      });

      const { useTwoFAStatistics } = await import('../use-twofa-messages');
      const { result } = renderHook(() => useTwoFAStatistics('email', ['default'], '2026-04-01', '2026-04-07'), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.[0]).toEqual({
        date: '2026-04-01',
        method: 'email',
        group: 'default',
        countTotal: 100,
        countSuccess: 95,
        countError: 5,
        countVerifyValidated: 80,
        countVerifyRejected: 10,
      });
    });

    it('is disabled when groups array is empty', async () => {
      const { useTwoFAStatistics } = await import('../use-twofa-messages');
      const { result } = renderHook(() => useTwoFAStatistics('email', [], '2026-04-01', '2026-04-07'), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useTwoFAMessageOptions', () => {
    it('calls list endpoint with pageSize=100', async () => {
      const { useTwoFAMessageOptions } = await import('../use-twofa-messages');
      const { result } = renderHook(() => useTwoFAMessageOptions('email'), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/messages', {
        params: expect.objectContaining({
          type: '2FA-email',
          itemsPerPage: 100,
        }),
        signal: expect.any(AbortSignal),
      });
    });
  });

  describe('useTwoFAMessageStatistics', () => {
    it('calls GET /statistics/email with groupByMessage and message IDs', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          '123': { general: { delivered: 100, open: 50, bounce: 5, unsubscribe: 2 } },
        },
      });

      const { useTwoFAMessageStatistics } = await import('../use-twofa-messages');
      const { result } = renderHook(() => useTwoFAMessageStatistics([123], 'email', '2026-04-01', '2026-04-07'), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/statistics/email', {
        params: {
          startDate: '2026-04-01',
          endDate: '2026-04-07',
          groupByMessage: true,
          messages: [123],
        },
        paramsSerializer: { indexes: null },
        signal: expect.any(AbortSignal),
      });
    });

    it('returns per-message stats data', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          '123': { general: { delivered: 100, open: 50, bounce: 5, unsubscribe: 2 } },
        },
      });

      const { useTwoFAMessageStatistics } = await import('../use-twofa-messages');
      const { result } = renderHook(() => useTwoFAMessageStatistics([123], 'email', '2026-04-01', '2026-04-07'), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.['123']?.general?.delivered).toBe(100);
      expect(result.current.data?.['123']?.general?.open).toBe(50);
    });

    it('uses /statistics/sms for sms channel', async () => {
      mockGet.mockResolvedValueOnce({ data: {} });

      const { useTwoFAMessageStatistics } = await import('../use-twofa-messages');
      const { result } = renderHook(() => useTwoFAMessageStatistics([456], 'sms', '2026-04-01', '2026-04-07'), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith('/statistics/sms', expect.any(Object));
    });

    it('is disabled when messageIds is empty', async () => {
      const { useTwoFAMessageStatistics } = await import('../use-twofa-messages');
      const { result } = renderHook(() => useTwoFAMessageStatistics([], 'email', '2026-04-01', '2026-04-07'), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});
