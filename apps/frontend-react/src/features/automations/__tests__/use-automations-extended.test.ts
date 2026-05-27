// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore, resetAuthStore } from '@/test-utils/authenticate-store';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/api-error', () => ({
  extractApiErrorMessage: vi.fn(() => 'mock error'),
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);

describe('useAutomations extended hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  // -----------------------------------------------------------------------
  // useAutomationsList — status filter
  // -----------------------------------------------------------------------
  describe('useAutomationsList status filter', () => {
    beforeEach(() => {
      mockGet.mockResolvedValue({
        data: { results: [], totalItems: 0, page: 1, itemsPerPage: 10 },
      });
    });

    it('sends isActive=1 when status is active', async () => {
      const { useAutomationsList } = await import('../use-automations');
      const { result } = renderHook(
        () =>
          useAutomationsList({
            page: 1,
            pageSize: 10,
            search: '',
            sort: '',
            order: 'asc',
            status: 'active',
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith('/automations', {
        params: expect.objectContaining({ isActive: '1' }),
        signal: expect.any(AbortSignal),
      });
    });

    it('sends isActive=0 when status is inactive', async () => {
      const { useAutomationsList } = await import('../use-automations');
      const { result } = renderHook(
        () =>
          useAutomationsList({
            page: 1,
            pageSize: 10,
            search: '',
            sort: '',
            order: 'asc',
            status: 'inactive',
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith('/automations', {
        params: expect.objectContaining({ isActive: '0' }),
        signal: expect.any(AbortSignal),
      });
    });

    it('omits isActive when status is all', async () => {
      const { useAutomationsList } = await import('../use-automations');
      const { result } = renderHook(
        () =>
          useAutomationsList({
            page: 1,
            pageSize: 10,
            search: '',
            sort: '',
            order: 'asc',
            status: 'all',
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const params = mockGet.mock.calls[0][1]?.params as Record<string, unknown>;
      expect(params).not.toHaveProperty('isActive');
    });

    it('includes sort params when provided', async () => {
      const { useAutomationsList } = await import('../use-automations');
      const { result } = renderHook(
        () =>
          useAutomationsList({
            page: 1,
            pageSize: 10,
            search: '',
            sort: 'updatedAt',
            order: 'desc',
            status: 'active',
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith('/automations', {
        params: expect.objectContaining({ sortBy: 'updatedAt', order: 'desc' }),
        signal: expect.any(AbortSignal),
      });
    });
  });

  // -----------------------------------------------------------------------
  // useAutomationDetail
  // -----------------------------------------------------------------------
  describe('useAutomationDetail', () => {
    it('calls GET /automations/:id', async () => {
      const automationData = { id: 42, title: 'My Automation', type: 'email', isActive: true };
      mockGet.mockResolvedValue({ data: automationData });

      const { useAutomationDetail } = await import('../use-automations');
      const { result } = renderHook(() => useAutomationDetail(42), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith('/automations/42');
      expect(result.current.data).toEqual(automationData);
    });

    it('is disabled when id is 0', async () => {
      const { useAutomationDetail } = await import('../use-automations');
      const { result } = renderHook(() => useAutomationDetail(0), {
        wrapper: createQueryWrapper(),
      });

      // Should not fetch
      await new Promise((r) => setTimeout(r, 50));
      expect(result.current.fetchStatus).toBe('idle');
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('is disabled when not authenticated', async () => {
      resetAuthStore();
      const { useAutomationDetail } = await import('../use-automations');
      const { result } = renderHook(() => useAutomationDetail(42), {
        wrapper: createQueryWrapper(),
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  // -----------------------------------------------------------------------
  // useMessageStatistics
  // -----------------------------------------------------------------------
  describe('useMessageStatistics', () => {
    it('calls GET /statistics/messages with correct params', async () => {
      const statsData = { '100': { message_id: 100, delivered: 500, open: 200 } };
      mockGet.mockResolvedValue({ data: statsData });

      const { useMessageStatistics } = await import('../use-automations');
      const { result } = renderHook(() => useMessageStatistics(1, [100], [200], [300], 7), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith('/statistics/messages', {
        params: expect.objectContaining({
          email: [100],
          webPush: [200],
          mobilePush: [300],
          automationId: 1,
        }),
      });
      expect(result.current.data).toEqual(statsData);
    });

    it('is disabled when no message IDs are provided', async () => {
      const { useMessageStatistics } = await import('../use-automations');
      const { result } = renderHook(() => useMessageStatistics(1, [], [], [], 7), {
        wrapper: createQueryWrapper(),
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('is disabled when automationId is 0', async () => {
      const { useMessageStatistics } = await import('../use-automations');
      const { result } = renderHook(() => useMessageStatistics(0, [1], [], [], 7), {
        wrapper: createQueryWrapper(),
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('returns empty object when API returns null', async () => {
      mockGet.mockResolvedValue({ data: null });

      const { useMessageStatistics } = await import('../use-automations');
      const { result } = renderHook(() => useMessageStatistics(1, [100], [], [], 7), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // useAutomationStatistics
  // -----------------------------------------------------------------------
  describe('useAutomationStatistics', () => {
    it('returns first element of array response', async () => {
      const stats = {
        unique_open: 50,
        unique_click: 30,
        total_running: 100,
        total_running_today: 10,
      };
      mockGet.mockResolvedValue({ data: [stats] });

      const { useAutomationStatistics } = await import('../use-automations');
      const { result } = renderHook(() => useAutomationStatistics(1), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith('/statistics/automation/1');
      expect(result.current.data).toEqual(stats);
    });

    it('returns zeroed stats when API returns empty array', async () => {
      mockGet.mockResolvedValue({ data: [] });

      const { useAutomationStatistics } = await import('../use-automations');
      const { result } = renderHook(() => useAutomationStatistics(1), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({
        unique_open: 0,
        unique_click: 0,
        total_running: 0,
        total_running_today: 0,
      });
    });

    it('is disabled when automationId is 0', async () => {
      const { useAutomationStatistics } = await import('../use-automations');
      const { result } = renderHook(() => useAutomationStatistics(0), {
        wrapper: createQueryWrapper(),
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  // -----------------------------------------------------------------------
  // useAutomationGoalStats
  // -----------------------------------------------------------------------
  describe('useAutomationGoalStats', () => {
    it('calls GET /automations/target/statistics with date range', async () => {
      const goalData = [
        { date: '2026-04-01', count: 5 },
        { date: '2026-04-02', count: 8 },
      ];
      mockGet.mockResolvedValue({ data: goalData });

      const { useAutomationGoalStats } = await import('../use-automations');
      const { result } = renderHook(() => useAutomationGoalStats(1, '2026-04-01', '2026-04-06'), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith('/automations/target/statistics', {
        params: { automationId: 1, startDate: '2026-04-01', endDate: '2026-04-06' },
      });
      expect(result.current.data).toEqual(goalData);
    });

    it('returns empty array when API returns non-array', async () => {
      mockGet.mockResolvedValue({ data: null });

      const { useAutomationGoalStats } = await import('../use-automations');
      const { result } = renderHook(() => useAutomationGoalStats(1, '2026-04-01', '2026-04-06'), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it('is disabled when dates are empty', async () => {
      const { useAutomationGoalStats } = await import('../use-automations');
      const { result } = renderHook(() => useAutomationGoalStats(1, '', ''), {
        wrapper: createQueryWrapper(),
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  // -----------------------------------------------------------------------
  // useAutomationAudits
  // -----------------------------------------------------------------------
  describe('useAutomationAudits', () => {
    it('calls GET /audits/:automationId', async () => {
      const audits = [
        {
          id: 1,
          entityId: 42,
          type: 'update',
          oldValues: {},
          newValues: {},
          user: '{}',
          createdAt: '2026-04-01',
        },
      ];
      mockGet.mockResolvedValue({ data: audits });

      const { useAutomationAudits } = await import('../use-automations');
      const { result } = renderHook(() => useAutomationAudits(42), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith('/audits/42');
      expect(result.current.data).toEqual(audits);
    });

    it('returns empty array when API returns non-array', async () => {
      mockGet.mockResolvedValue({ data: 'invalid' });

      const { useAutomationAudits } = await import('../use-automations');
      const { result } = renderHook(() => useAutomationAudits(42), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it('is disabled when automationId is 0', async () => {
      const { useAutomationAudits } = await import('../use-automations');
      const { result } = renderHook(() => useAutomationAudits(0), {
        wrapper: createQueryWrapper(),
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  // -----------------------------------------------------------------------
  // useCreateAutomation
  // -----------------------------------------------------------------------
  describe('useCreateAutomation', () => {
    it('calls POST /automations/complete with payload', async () => {
      const created = { id: 99, title: 'New' };
      mockPost.mockResolvedValue({ data: created });

      const { useCreateAutomation } = await import('../use-automations');
      const { result } = renderHook(() => useCreateAutomation(), {
        wrapper: createQueryWrapper(),
      });

      const payload = {
        title: 'New',
        isActive: false,
        isRateLimit: false,
        stepId: 1,
        steps: { id: 1, type: 'trigger', settings: {}, child: [] } as any,
      };
      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockPost).toHaveBeenCalledWith('/automations/complete', payload);
      expect(result.current.data).toEqual(created);
    });

    it('shows toast on error', async () => {
      mockPost.mockRejectedValue(new Error('fail'));

      const { useCreateAutomation } = await import('../use-automations');
      const { result } = renderHook(() => useCreateAutomation(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate({
        title: 'Fail',
        isActive: false,
        isRateLimit: false,
        stepId: 1,
        steps: { id: 1, type: 'trigger', settings: {}, child: [] } as any,
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // -----------------------------------------------------------------------
  // useUpdateAutomation
  // -----------------------------------------------------------------------
  describe('useUpdateAutomation', () => {
    it('calls PUT /automations/complete with payload', async () => {
      const updated = { id: 1, title: 'Updated' };
      mockPut.mockResolvedValue({ data: updated });

      const { useUpdateAutomation } = await import('../use-automations');
      const { result } = renderHook(() => useUpdateAutomation(), {
        wrapper: createQueryWrapper(),
      });

      const payload = {
        id: 1,
        title: 'Updated',
        isActive: true,
        isRateLimit: false,
        stepId: 1,
        steps: { id: 1, type: 'trigger', settings: {}, child: [] } as any,
      };
      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockPut).toHaveBeenCalledWith('/automations/complete', payload);
      expect(result.current.data).toEqual(updated);
    });

    it('shows toast on error', async () => {
      mockPut.mockRejectedValue(new Error('fail'));

      const { useUpdateAutomation } = await import('../use-automations');
      const { result } = renderHook(() => useUpdateAutomation(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate({
        id: 1,
        title: 'Fail',
        isActive: true,
        isRateLimit: false,
        stepId: 1,
        steps: { id: 1, type: 'trigger', settings: {}, child: [] } as any,
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
