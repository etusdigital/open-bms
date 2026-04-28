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
          domain: 'plusdin.com.br',
          dates: [
            {
              date: '2026-03-30',
              time: 1743292800,
              domainReputation: 'high',
              spamRatio: 0.12,
              spfRatio: 98.5,
              dkimRatio: 99.1,
              dmarcRatio: 97.3,
              inboundRatio: 0.95,
              spamLoops: null,
              deliveryErrors: null,
              ips: [
                { ip: '192.168.1.10', reputation: 'high' },
                { ip: '192.168.1.11', reputation: 'medium' },
              ],
            },
          ],
        },
      ],
    }),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = vi.mocked(apiClient.get);

describe('usePostmaster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockGet.mockResolvedValue({
      data: [
        {
          domain: 'plusdin.com.br',
          dates: [
            {
              date: '2026-03-30',
              time: 1743292800,
              domainReputation: 'high',
              spamRatio: 0.12,
              spfRatio: 98.5,
              dkimRatio: 99.1,
              dmarcRatio: 97.3,
              inboundRatio: 0.95,
              spamLoops: null,
              deliveryErrors: null,
              ips: [
                { ip: '192.168.1.10', reputation: 'high' },
                { ip: '192.168.1.11', reputation: 'medium' },
              ],
            },
          ],
        },
      ],
    } as never);
  });

  it('calls GET /postmaster with startDate and endDate', async () => {
    const { usePostmaster } = await import('../use-postmaster');
    const { result } = renderHook(() => usePostmaster('2026-03-24', '2026-03-30'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/postmaster', {
      params: { startDate: '2026-03-24', endDate: '2026-03-30' },
      signal: expect.any(AbortSignal),
    });
  });

  it('returns PostmasterDomain[] with domains and dates', async () => {
    const { usePostmaster } = await import('../use-postmaster');
    const { result } = renderHook(() => usePostmaster('2026-03-24', '2026-03-30'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].domain).toBe('plusdin.com.br');
    expect(result.current.data![0].dates).toHaveLength(1);
    expect(result.current.data![0].dates[0].ips).toHaveLength(2);
  });
});
