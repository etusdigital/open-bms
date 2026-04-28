// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    put: vi.fn().mockResolvedValue({}),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockPut = vi.mocked(apiClient.put);

describe('useSettings hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  describe('useAccountConfig', () => {
    it('returns config value from store', async () => {
      authenticateStore({
        accountConfigs: [{ accountId: 1, name: 'api_key', value: 'test-key-123', isLoadConfig: true }],
      });

      const { useAccountConfig } = await import('../use-settings');
      const { result } = renderHook(() => useAccountConfig('api_key'));

      expect(result.current).toBe('test-key-123');
    });

    it('returns empty string for missing config', async () => {
      const { useAccountConfig } = await import('../use-settings');
      const { result } = renderHook(() => useAccountConfig('nonexistent'));

      expect(result.current).toBe('');
    });
  });

  describe('useTimezone', () => {
    it('returns timezone from store', async () => {
      authenticateStore({ timezone: 'America/Sao_Paulo' });

      const { useTimezone } = await import('../use-settings');
      const { result } = renderHook(() => useTimezone());

      expect(result.current).toBe('America/Sao_Paulo');
    });
  });

  describe('useUpdateAccountConfigs', () => {
    it('calls PUT /accounts/providers/:id', async () => {
      const { useUpdateAccountConfigs } = await import('../use-settings');
      const { result } = renderHook(() => useUpdateAccountConfigs(), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate({
        accountId: 1,
        configs: [{ account_id: 1, name: 'send_limit_per_user', value: '500' }],
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockPut).toHaveBeenCalledWith('/accounts/providers/1', [
        { account_id: 1, name: 'send_limit_per_user', value: '500' },
      ]);
    });
  });
});
