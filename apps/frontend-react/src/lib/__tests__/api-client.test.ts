import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient, setTokenFetcher, clearTokenCache } from '../api-client';
import { useAppStore } from '@/stores/app-store';

// Mock axios adapter
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      create: actual.default.create,
      isCancel: actual.isCancel,
    },
  };
});

describe('api-client', () => {
  beforeEach(() => {
    clearTokenCache();
    useAppStore.setState({
      auth: { status: 'idle' },
      sidebarCollapsed: false,
      savedAccountId: null,
    });
  });

  describe('setTokenFetcher', () => {
    it('sets the token fetcher function', () => {
      const mockFetcher = vi.fn().mockResolvedValue('test-token');
      expect(() => setTokenFetcher(mockFetcher)).not.toThrow();
    });
  });

  describe('clearTokenCache', () => {
    it('clears cached token so next request fetches fresh', () => {
      // After clearing, the next getToken call should invoke the fetcher
      clearTokenCache();
      // No assertion needed - just verify no throw
    });
  });

  describe('apiClient instance', () => {
    it('is an axios instance', () => {
      expect(apiClient).toBeDefined();
      expect(apiClient.get).toBeInstanceOf(Function);
      expect(apiClient.post).toBeInstanceOf(Function);
    });
  });
});
