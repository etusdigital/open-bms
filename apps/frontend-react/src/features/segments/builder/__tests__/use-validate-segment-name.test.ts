// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useValidateSegmentName } from '../use-validate-segment-name';

// Mock apiClient
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';
const mockGet = vi.mocked(apiClient.get);

describe('useValidateSegmentName', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('starts in IDLE state', () => {
    const { result } = renderHook(() => useValidateSegmentName());
    expect(result.current.state).toBe('idle');
    expect(result.current.canSubmit).toBe(true);
  });

  it('transitions to VALID when name is available', async () => {
    mockGet.mockResolvedValue({ data: { exists: false } });

    const { result } = renderHook(() => useValidateSegmentName());

    act(() => {
      result.current.validate('Unique Name');
    });

    await waitFor(
      () => {
        expect(result.current.state).toBe('valid');
      },
      { timeout: 2000 },
    );

    expect(result.current.canSubmit).toBe(true);
  });

  it('transitions to INVALID when name already exists', async () => {
    mockGet.mockResolvedValue({ data: { exists: true } });

    const { result } = renderHook(() => useValidateSegmentName());

    act(() => {
      result.current.validate('Existing Name');
    });

    await waitFor(
      () => {
        expect(result.current.state).toBe('invalid');
      },
      { timeout: 2000 },
    );

    expect(result.current.canSubmit).toBe(false);
  });

  it('resets to IDLE when name is empty', () => {
    const { result } = renderHook(() => useValidateSegmentName());

    act(() => {
      result.current.validate('');
    });

    expect(result.current.state).toBe('idle');
  });

  it('resets to IDLE when name is too short', () => {
    const { result } = renderHook(() => useValidateSegmentName());

    act(() => {
      result.current.validate('ab');
    });

    expect(result.current.state).toBe('idle');
  });

  it('passes excludeId to API for edit mode', async () => {
    mockGet.mockResolvedValue({ data: { exists: false } });

    const { result } = renderHook(() => useValidateSegmentName(42));

    act(() => {
      result.current.validate('Test Name');
    });

    await waitFor(
      () => {
        expect(mockGet).toHaveBeenCalledWith('/tags/validate-name', {
          params: { titleCreate: 'Test Name', id: 42 },
        });
      },
      { timeout: 2000 },
    );
  });

  it('handles API errors gracefully (falls back to idle)', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useValidateSegmentName());

    act(() => {
      result.current.validate('Test Name');
    });

    // Should eventually fall back to idle on error
    await waitFor(
      () => {
        // After the debounce + API error, state goes back to idle
        expect(result.current.state).toBe('idle');
      },
      { timeout: 2000 },
    );

    expect(result.current.canSubmit).toBe(true);
  });

  it('discards stale responses when name changes rapidly', async () => {
    let callCount = 0;
    mockGet.mockImplementation(async () => {
      callCount++;
      const thisCall = callCount;
      // First call: name exists. Second call: name available.
      if (thisCall === 1) {
        // Simulate slow response
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { data: { exists: true } };
      }
      return { data: { exists: false } };
    });

    const { result } = renderHook(() => useValidateSegmentName());

    // Type first name
    act(() => {
      result.current.validate('Foo');
    });

    // Quickly change to second name (within debounce)
    await new Promise((resolve) => setTimeout(resolve, 100));
    act(() => {
      result.current.validate('Foobar');
    });

    // Wait for resolution
    await waitFor(
      () => {
        expect(result.current.state).toBe('valid');
      },
      { timeout: 3000 },
    );
  });

  it('reset clears state back to idle', async () => {
    mockGet.mockResolvedValue({ data: { exists: true } });

    const { result } = renderHook(() => useValidateSegmentName());

    act(() => {
      result.current.validate('Existing Name');
    });

    await waitFor(
      () => {
        expect(result.current.state).toBe('invalid');
      },
      { timeout: 2000 },
    );

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.canSubmit).toBe(true);
  });
});
