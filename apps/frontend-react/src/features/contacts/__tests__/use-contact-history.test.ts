// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import { useContactHistory, CONTACT_HISTORY_PAGE_SIZE } from '../use-contact-history';

const mockGet = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

const historyPage1 = [
  { type: 'message', message_title: 'Newsletter', event: 'sent', time: '2026-01-01T00:00:00Z' },
  { type: 'automation', automation_title: 'Welcome', time: '2026-01-02T00:00:00Z' },
];

describe('useContactHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockGet.mockResolvedValue({ data: { results: historyPage1, hasMore: false } });
  });

  it('fetches history for a contact', async () => {
    const { result } = renderHook(() => useContactHistory(5), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      '/contacts/history/5',
      expect.objectContaining({
        params: expect.objectContaining({ page: 1, itemsPerPage: CONTACT_HISTORY_PAGE_SIZE }),
      }),
    );
    expect(result.current.data?.pages[0].results).toHaveLength(2);
  });

  it('does not fetch when contactId is 0', () => {
    const { result } = renderHook(() => useContactHistory(0), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('passes activity type filter when not "all"', async () => {
    const { result } = renderHook(() => useContactHistory(5, { activityType: 'message' }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      '/contacts/history/5',
      expect.objectContaining({
        params: expect.objectContaining({ activities: 'message' }),
      }),
    );
  });

  it('omits activity type filter when "all"', async () => {
    const { result } = renderHook(() => useContactHistory(5, { activityType: 'all' }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const params = mockGet.mock.calls[0][1].params;
    expect(params).not.toHaveProperty('activities');
  });

  it('passes channel filter', async () => {
    const { result } = renderHook(() => useContactHistory(5, { channel: 'email' }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      '/contacts/history/5',
      expect.objectContaining({
        params: expect.objectContaining({ channels: 'email' }),
      }),
    );
  });

  it('passes date range filters', async () => {
    const { result } = renderHook(() => useContactHistory(5, { startDate: '2026-01-01', endDate: '2026-01-31' }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      '/contacts/history/5',
      expect.objectContaining({
        params: expect.objectContaining({
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        }),
      }),
    );
  });

  it('has next page when the API response signals hasMore=true', async () => {
    mockGet.mockResolvedValue({ data: { results: [{ type: 'message' }], hasMore: true } });

    const { result } = renderHook(() => useContactHistory(5), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('has no next page when the API response signals hasMore=false', async () => {
    mockGet.mockResolvedValue({ data: { results: [{ type: 'message' }], hasMore: false } });

    const { result } = renderHook(() => useContactHistory(5), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('falls back to the length-based heuristic when the API omits hasMore (backward compat)', async () => {
    // No hasMore field on the response → frontend falls back to
    // `length === CONTACT_HISTORY_PAGE_SIZE` to keep older API deploys working.
    const fullPage = Array.from({ length: CONTACT_HISTORY_PAGE_SIZE }, (_, i) => ({
      type: 'message',
      message_title: `Msg ${i}`,
      time: '2026-01-01T00:00:00Z',
    }));
    mockGet.mockResolvedValue({ data: { results: fullPage } });

    const { result } = renderHook(() => useContactHistory(5), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });
});
