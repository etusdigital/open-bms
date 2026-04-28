// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: [
        {
          utm_source: 'google',
          total: 100,
          total_unique: '80 (80.0%)',
          valid: '70 (70.0%)',
          new: '60 (60.0%)',
          old: '40 (40.0%)',
          bounced: '5 (5.0%)',
          invalid: '3 (3.0%)',
          automation_entry: '50 (50.0%)',
          automation_duplicated: '2 (2.0%)',
        },
      ],
    }),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);

describe('useLeads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('calls GET /statistics/leads with groupItems array', async () => {
    const { useLeads } = await import('../use-leads');
    const { result } = renderHook(
      () =>
        useLeads({
          groupItems: ['utm_source'],
          startDate: '2026-04-01',
          endDate: '2026-04-08',
          search: [],
        }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/statistics/leads', {
      params: expect.objectContaining({
        groupItems: ['utm_source'],
        startDate: '2026-04-01',
        endDate: '2026-04-08',
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('includes search param when filters provided', async () => {
    const { useLeads } = await import('../use-leads');
    const { result } = renderHook(
      () =>
        useLeads({
          groupItems: ['utm_source'],
          startDate: '2026-04-01',
          endDate: '2026-04-08',
          search: ['email_provider:Gmail', 'utm_source:google'],
        }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/statistics/leads', {
      params: expect.objectContaining({ search: ['email_provider:Gmail', 'utm_source:google'] }),
      signal: expect.any(AbortSignal),
    });
  });

  it('does not fetch when groupItems is empty', async () => {
    const { useLeads } = await import('../use-leads');
    renderHook(() => useLeads({ groupItems: [], startDate: '2026-04-01', endDate: '2026-04-08', search: [] }), {
      wrapper: createQueryWrapper(),
    });

    // Should not call API since no group items selected
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns leads data array', async () => {
    const { useLeads } = await import('../use-leads');
    const { result } = renderHook(
      () =>
        useLeads({
          groupItems: ['utm_source'],
          startDate: '2026-04-01',
          endDate: '2026-04-08',
          search: [],
        }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].utm_source).toBe('google');
    expect(result.current.data![0].total).toBe(100);
  });
});
