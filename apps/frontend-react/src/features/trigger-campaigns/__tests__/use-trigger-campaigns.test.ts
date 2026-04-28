// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import type { Campaign } from '@/features/campaigns/types';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: {
        results: [
          {
            id: 1,
            title: 'Abandoned Cart',
            type: 'simple',
            messageType: 'email',
            status: 0,
            sendToAll: false,
            isTrigger: true,
            updatedAt: '2026-03-13T10:00:00Z',
            sentContacts: 120,
          },
        ],
        totalItems: 1,
        page: 1,
        itemsPerPage: 10,
      },
    }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);
const mockDelete = vi.mocked(apiClient.delete);

describe('useTriggerCampaigns hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  describe('useTriggerCampaignsList', () => {
    it('calls GET /campaigns with isTrigger=true', async () => {
      const { useTriggerCampaignsList } = await import('../use-trigger-campaigns');
      const { result } = renderHook(
        () =>
          useTriggerCampaignsList({
            page: 1,
            pageSize: 10,
            search: '',
            sort: '',
            order: 'asc',
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/campaigns', {
        params: expect.objectContaining({ page: 1, itemsPerPage: 10, isTrigger: true }),
        signal: expect.any(AbortSignal),
      });
    });

    it('includes search param when provided', async () => {
      const { useTriggerCampaignsList } = await import('../use-trigger-campaigns');
      const { result } = renderHook(
        () =>
          useTriggerCampaignsList({
            page: 1,
            pageSize: 10,
            search: 'cart',
            sort: '',
            order: 'asc',
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/campaigns', {
        params: expect.objectContaining({ title: 'cart' }),
        signal: expect.any(AbortSignal),
      });
    });

    it('returns paginated data', async () => {
      const { useTriggerCampaignsList } = await import('../use-trigger-campaigns');
      const { result } = renderHook(
        () =>
          useTriggerCampaignsList({
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
      expect(result.current.data?.data[0].title).toBe('Abandoned Cart');
    });
  });

  describe('useTriggerCampaign', () => {
    it('calls GET /campaigns/:id', async () => {
      mockGet.mockResolvedValueOnce({
        data: { id: 5, title: 'Welcome', type: 'simple', isTrigger: true } as Campaign,
      } as never);

      const { useTriggerCampaign } = await import('../use-trigger-campaigns');
      const { result } = renderHook(() => useTriggerCampaign(5), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith('/campaigns/5', { signal: expect.any(AbortSignal) });
    });
  });

  describe('useTriggerCampaignListStats', () => {
    it('returns empty map when campaigns is empty', async () => {
      const { useTriggerCampaignListStats } = await import('../use-trigger-campaigns');
      const { result } = renderHook(() => useTriggerCampaignListStats([]), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.size).toBe(0);
    });

    it('fetches stats and computes metrics', async () => {
      mockGet.mockImplementation((url: string) => {
        if (url === '/statistics/email') {
          return Promise.resolve({
            data: {
              general: {
                delivered: 80,
                open: 40,
                click: 20,
                unsubscribe: 2,
                bounce: 5,
                sent: 100,
                close: 0,
                blocked: 0,
                unique_opens: 35,
                unique_clicks: 18,
              },
            },
          });
        }
        // Default list response
        return Promise.resolve({
          data: {
            results: [],
            totalItems: 0,
            page: 1,
            itemsPerPage: 10,
          },
        });
      });

      const campaigns = [
        {
          id: 1,
          title: 'Test',
          type: 'simple' as const,
          messageType: 'email' as const,
          status: 1,
          sendToAll: false,
          sentContacts: 100,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const { useTriggerCampaignListStats } = await import('../use-trigger-campaigns');
      const { result } = renderHook(() => useTriggerCampaignListStats(campaigns as any), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.size).toBe(1));

      const stats = result.current.get(1)!;
      expect(stats.deliveredRate).toBe('80.00%'); // 80/100
      expect(stats.openRate).toBe('50.00%'); // 40/80
      expect(stats.ctr).toBe('25.00%'); // 20/80
      expect(stats.ctor).toBe('50.00%'); // 20/40
      expect(stats.unsubscribeCount).toBe(2);
      expect(stats.bounceCount).toBe(5);
    });

    it('handles zero sentContacts gracefully', async () => {
      mockGet.mockImplementation((url: string) => {
        if (url === '/statistics/email') {
          return Promise.resolve({
            data: {
              general: {
                delivered: 0,
                open: 0,
                click: 0,
                unsubscribe: 0,
                bounce: 0,
                sent: 0,
                close: 0,
                blocked: 0,
                unique_opens: 0,
                unique_clicks: 0,
              },
            },
          });
        }
        return Promise.resolve({ data: { results: [], totalItems: 0, page: 1, itemsPerPage: 10 } });
      });

      const campaigns = [
        {
          id: 2,
          title: 'Empty',
          type: 'simple' as const,
          messageType: 'email' as const,
          status: 1,
          sendToAll: false,
          sentContacts: 0,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const { useTriggerCampaignListStats } = await import('../use-trigger-campaigns');
      const { result } = renderHook(() => useTriggerCampaignListStats(campaigns as any), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.size).toBe(1));

      const stats = result.current.get(2)!;
      expect(stats.deliveredRate).toBe('0%');
      expect(stats.openRate).toBe('0%');
      expect(stats.ctr).toBe('0%');
      expect(stats.ctor).toBe('0%');
      expect(stats.unsubscribeCount).toBe(0);
      expect(stats.bounceCount).toBe(0);
    });
  });

  describe('formatRate', () => {
    it('calculates percentage correctly', async () => {
      const { formatRate } = await import('@/features/campaigns/types');
      expect(formatRate(50, 100)).toBe('50.00%');
    });

    it('returns 0% when denominator is zero', async () => {
      const { formatRate } = await import('@/features/campaigns/types');
      expect(formatRate(10, 0)).toBe('0%');
    });

    it('formats with 2 decimal places', async () => {
      const { formatRate } = await import('@/features/campaigns/types');
      expect(formatRate(1, 3)).toBe('33.33%');
    });

    it('handles zero numerator', async () => {
      const { formatRate } = await import('@/features/campaigns/types');
      expect(formatRate(0, 100)).toBe('0.00%');
    });
  });

  describe('useDeleteTriggerCampaign', () => {
    it('calls DELETE /campaigns/:id', async () => {
      const { useDeleteTriggerCampaign } = await import('../use-trigger-campaigns');
      const { result } = renderHook(() => useDeleteTriggerCampaign(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockDelete).toHaveBeenCalledWith('/campaigns/1');
    });
  });
});
