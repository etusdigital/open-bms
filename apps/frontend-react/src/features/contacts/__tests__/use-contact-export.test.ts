// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { useContactExport } from '../use-contact-export';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockGet = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

import { toast } from 'sonner';

// Suppress jsdom "Not implemented: navigation" errors from anchor.click()
const originalError = console.error;

describe('useContactExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    authenticateStore();

    const blob = new Blob(['csv,data'], { type: 'text/csv' });
    mockGet.mockResolvedValue({ data: blob });

    // Mock URL.createObjectURL/revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();

    // Suppress jsdom "Not implemented: navigation" errors from anchor.click()
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('Not implemented: navigation')) return;
      originalError(...args);
    };
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('calls GET /contacts/export-stream with contact IDs', async () => {
    const { result } = renderHook(() => useContactExport(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      result.current.mutate([1, 2, 3]);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/contacts/export-stream', {
      params: { contacts: [1, 2, 3] },
      responseType: 'blob',
    });
  });

  it('triggers file download via anchor element', async () => {
    const clickSpy = vi.fn();
    const anchor = { href: '', download: '', click: clickSpy };
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return anchor as unknown as HTMLAnchorElement;
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement;
    });

    const { result } = renderHook(() => useContactExport(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      result.current.mutate([1]);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(clickSpy).toHaveBeenCalled();
    expect(anchor.download).toMatch(/contacts-.*\.csv/);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('shows success toast', async () => {
    const { result } = renderHook(() => useContactExport(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      result.current.mutate([1]);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toast.success).toHaveBeenCalled();
  });

  it('shows error toast on failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('export failed'));

    const { result } = renderHook(() => useContactExport(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      result.current.mutate([1]);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalled();
  });
});
