// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import type { Campaign } from '../types';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: {
        results: [
          {
            id: 1,
            title: 'Black Friday',
            type: 'simple',
            messageType: 'email',
            status: 0,
            sendToAll: false,
            updatedAt: '2026-03-13T10:00:00Z',
          },
        ],
        totalItems: 1,
        page: 1,
        itemsPerPage: 10,
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 2, title: 'New' } }),
    put: vi.fn().mockResolvedValue({ data: { id: 1, title: 'Updated' } }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockDelete = vi.mocked(apiClient.delete);

describe('useCampaigns hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  describe('useCampaignsList', () => {
    it('calls GET /campaigns with isTrigger=false', async () => {
      const { useCampaignsList } = await import('../use-campaigns');
      const { result } = renderHook(
        () =>
          useCampaignsList({
            page: 1,
            pageSize: 10,
            search: '',
            sort: '',
            order: 'asc',
            status: '',
            types: '',
            messages: '',
            tags: '',
            segments: '',
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/campaigns', {
        params: expect.objectContaining({ page: 1, itemsPerPage: 10, isTrigger: false }),
        signal: expect.any(AbortSignal),
      });
    });

    it('includes search param when provided', async () => {
      const { useCampaignsList } = await import('../use-campaigns');
      const { result } = renderHook(
        () =>
          useCampaignsList({
            page: 1,
            pageSize: 10,
            search: 'black',
            sort: '',
            order: 'asc',
            status: '',
            types: '',
            messages: '',
            tags: '',
            segments: '',
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/campaigns', {
        params: expect.objectContaining({ title: 'black' }),
        signal: expect.any(AbortSignal),
      });
    });

    it('returns paginated data', async () => {
      const { useCampaignsList } = await import('../use-campaigns');
      const { result } = renderHook(
        () =>
          useCampaignsList({
            page: 1,
            pageSize: 10,
            search: '',
            sort: '',
            order: 'asc',
            status: '',
            types: '',
            messages: '',
            tags: '',
            segments: '',
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toHaveLength(1);
    });

    it('includes filter params when provided', async () => {
      const { useCampaignsList } = await import('../use-campaigns');
      const { result } = renderHook(
        () =>
          useCampaignsList({
            page: 1,
            pageSize: 10,
            search: '',
            sort: '',
            order: 'asc',
            status: '0,5',
            types: 'simple,testAB',
            messages: 'email,sms',
            tags: '1,2',
            segments: '3',
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/campaigns', {
        params: expect.objectContaining({
          status: [0, 5],
          types: ['simple', 'testAB'],
          messages: ['email', 'sms'],
          tags: [1, 2],
          segments: [3],
        }),
        signal: expect.any(AbortSignal),
      });
    });

    it('omits empty filter params', async () => {
      const { useCampaignsList } = await import('../use-campaigns');
      const { result } = renderHook(
        () =>
          useCampaignsList({
            page: 1,
            pageSize: 10,
            search: '',
            sort: '',
            order: 'asc',
            status: '',
            types: '',
            messages: '',
            tags: '',
            segments: '',
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('/campaigns', {
        params: expect.not.objectContaining({
          status: expect.anything(),
          types: expect.anything(),
          messages: expect.anything(),
          tags: expect.anything(),
          segments: expect.anything(),
        }),
        signal: expect.any(AbortSignal),
      });
    });
  });

  describe('useCampaign', () => {
    it('calls GET /campaigns/:id', async () => {
      mockGet.mockResolvedValueOnce({
        data: { id: 5, title: 'Test', type: 'simple' } as Campaign,
      } as never);

      const { useCampaign } = await import('../use-campaigns');
      const { result } = renderHook(() => useCampaign(5), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith('/campaigns/5', { signal: expect.any(AbortSignal) });
    });
  });

  describe('useDeleteCampaign', () => {
    it('calls DELETE /campaigns/:id', async () => {
      const { useDeleteCampaign } = await import('../use-campaigns');
      const { result } = renderHook(() => useDeleteCampaign(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockDelete).toHaveBeenCalledWith('/campaigns/1');
    });
  });

  describe('useDuplicateCampaign', () => {
    it('calls POST /campaigns/duplicate/:id', async () => {
      const { useDuplicateCampaign } = await import('../use-campaigns');
      const { result } = renderHook(() => useDuplicateCampaign(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate(1);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockPost).toHaveBeenCalledWith('/campaigns/duplicate/1');
    });
  });

  describe('useCampaignStatusCounts', () => {
    it('fetches GET /campaigns/statistics-all and returns status counts', async () => {
      mockGet.mockResolvedValueOnce({
        data: [
          { status: 1, count_status: '29' },
          { status: 2, count_status: '1' },
          { status: 5, count_status: '1012' },
          { status: 6, count_status: '1' },
        ],
      } as never);

      const { useCampaignStatusCounts } = await import('../use-campaigns');
      const { result } = renderHook(
        () =>
          useCampaignStatusCounts({
            page: 1,
            pageSize: 10,
            search: '',
            sort: '',
            order: 'asc',
            status: '',
            types: '',
            messages: '',
            tags: '',
            segments: '',
            startDate: '',
            endDate: '',
          }),
        {
          wrapper: createQueryWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual({
        sending: 2, // status 2 + status 6
        scheduled: 29, // status 1
        completed: 1012, // status 5
      });
    });

    it('returns zeros when no data', async () => {
      mockGet.mockResolvedValueOnce({ data: [] } as never);

      const { useCampaignStatusCounts } = await import('../use-campaigns');
      const { result } = renderHook(
        () =>
          useCampaignStatusCounts({
            page: 1,
            pageSize: 10,
            search: '',
            sort: '',
            order: 'asc',
            status: '',
            types: '',
            messages: '',
            tags: '',
            segments: '',
            startDate: '',
            endDate: '',
          }),
        {
          wrapper: createQueryWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual({
        sending: 0,
        scheduled: 0,
        completed: 0,
      });
    });
  });

  describe('useCampaignListStats', () => {
    it('returns empty map for empty campaigns array', async () => {
      const { useCampaignListStats } = await import('../use-campaigns');
      const { result } = renderHook(() => useCampaignListStats([]), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.size).toBe(0);
    });

    it('sends a single batch request with groupByCampaign for email campaigns', async () => {
      mockGet.mockImplementation((url: string, _config: any) => {
        if (url === '/statistics/email') {
          return Promise.resolve({
            data: {
              1: {
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
              2: {
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
            },
          });
        }
        return Promise.resolve({ data: {} });
      });

      const campaigns = [
        {
          id: 1,
          title: 'Email 1',
          type: 'simple' as const,
          messageType: 'email' as const,
          status: 5,
          sendToAll: false,
          sentContacts: 100,
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 2,
          title: 'Email 2',
          type: 'simple' as const,
          messageType: 'email' as const,
          status: 5,
          sendToAll: false,
          sentContacts: 0,
          createdAt: '2026-02-01T00:00:00Z',
        },
      ];

      const { useCampaignListStats } = await import('../use-campaigns');
      const { result } = renderHook(() => useCampaignListStats(campaigns as any), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.size).toBe(2));

      // Verify only ONE request was made (not two)
      const emailCalls = mockGet.mock.calls.filter(([url]: [string]) => url === '/statistics/email');
      expect(emailCalls).toHaveLength(1);

      // Verify groupByCampaign and both IDs were sent
      const params = emailCalls[0][1].params;
      expect(params.groupByCampaign).toBe(true);
      expect(params.campaigns).toEqual(expect.arrayContaining([1, 2]));

      // Verify stats computed correctly for campaign 1
      const stats1 = result.current.get(1)!;
      expect(stats1.deliveredRate).toBe('80.00%');
      expect(stats1.openRate).toBe('50.00%');
      expect(stats1.ctr).toBe('25.00%');
      expect(stats1.ctor).toBe('50.00%');
      expect(stats1.unsubscribeCount).toBe(2);
      expect(stats1.bounceCount).toBe(5);

      // Verify zero sentContacts handled
      const stats2 = result.current.get(2)!;
      expect(stats2.deliveredRate).toBe('0%');
      expect(stats2.openRate).toBe('0%');
    });

    it('uses /statistics/push for web-push campaigns', async () => {
      mockGet.mockImplementation((url: string) => {
        if (url === '/statistics/push') {
          return Promise.resolve({
            data: {
              3: {
                general: {
                  delivered: 50,
                  open: 25,
                  click: 10,
                  unsubscribe: 0,
                  bounce: 1,
                  sent: 60,
                  close: 0,
                  blocked: 0,
                  unique_opens: 20,
                  unique_clicks: 8,
                },
              },
            },
          });
        }
        return Promise.resolve({ data: {} });
      });

      const campaigns = [
        {
          id: 3,
          title: 'Push',
          type: 'simple' as const,
          messageType: 'web-push' as const,
          status: 5,
          sendToAll: false,
          sentContacts: 60,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const { useCampaignListStats } = await import('../use-campaigns');
      const { result } = renderHook(() => useCampaignListStats(campaigns as any), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.size).toBe(1));
      expect(mockGet).toHaveBeenCalledWith(
        '/statistics/push',
        expect.objectContaining({
          params: expect.objectContaining({ groupByCampaign: true, campaigns: [3] }),
        }),
      );
    });

    it('sends separate requests for email and push campaigns', async () => {
      mockGet.mockImplementation((url: string) => {
        if (url === '/statistics/email') {
          return Promise.resolve({
            data: {
              1: {
                general: {
                  delivered: 80,
                  open: 40,
                  click: 20,
                  unsubscribe: 0,
                  bounce: 0,
                  sent: 100,
                  close: 0,
                  blocked: 0,
                  unique_opens: 35,
                  unique_clicks: 18,
                },
              },
            },
          });
        }
        if (url === '/statistics/push') {
          return Promise.resolve({
            data: {
              2: {
                general: {
                  delivered: 50,
                  open: 25,
                  click: 10,
                  unsubscribe: 0,
                  bounce: 1,
                  sent: 60,
                  close: 0,
                  blocked: 0,
                  unique_opens: 20,
                  unique_clicks: 8,
                },
              },
            },
          });
        }
        return Promise.resolve({ data: {} });
      });

      const campaigns = [
        {
          id: 1,
          title: 'Email',
          type: 'simple' as const,
          messageType: 'email' as const,
          status: 5,
          sendToAll: false,
          sentContacts: 100,
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 2,
          title: 'Push',
          type: 'simple' as const,
          messageType: 'web-push' as const,
          status: 5,
          sendToAll: false,
          sentContacts: 60,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const { useCampaignListStats } = await import('../use-campaigns');
      const { result } = renderHook(() => useCampaignListStats(campaigns as any), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.size).toBe(2));

      // Verify TWO requests: one email, one push
      const emailCalls = mockGet.mock.calls.filter(([url]: [string]) => url === '/statistics/email');
      const pushCalls = mockGet.mock.calls.filter(([url]: [string]) => url === '/statistics/push');
      expect(emailCalls).toHaveLength(1);
      expect(pushCalls).toHaveLength(1);

      // Verify both stats populated
      expect(result.current.get(1)!.deliveredRate).toBe('80.00%');
      expect(result.current.get(2)!.deliveredRate).toBe('83.33%'); // 50/60
    });
  });

  describe('useUpdateCampaign', () => {
    it('sends PUT /campaigns with id in body, not URL', async () => {
      const mockPut = vi.mocked(apiClient.put);
      const { useUpdateCampaign } = await import('../use-campaigns');
      const { result } = renderHook(() => useUpdateCampaign(42), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate({ title: 'Updated Title' } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockPut).toHaveBeenCalledWith('/campaigns', {
        title: 'Updated Title',
        id: 42,
      });
    });
  });
});

describe('formatRate', () => {
  it('calculates percentage with 2 decimal places', async () => {
    const { formatRate } = await import('../types');
    expect(formatRate(1, 2)).toBe('50.00%');
  });

  it('returns 0% when denominator is zero', async () => {
    const { formatRate } = await import('../types');
    expect(formatRate(10, 0)).toBe('0%');
  });

  it('handles both zero', async () => {
    const { formatRate } = await import('../types');
    expect(formatRate(0, 0)).toBe('0%');
  });

  it('formats small fractions correctly', async () => {
    const { formatRate } = await import('../types');
    expect(formatRate(1, 3)).toBe('33.33%');
  });

  it('handles 100%', async () => {
    const { formatRate } = await import('../types');
    expect(formatRate(100, 100)).toBe('100.00%');
  });
});
