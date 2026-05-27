// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColumnVisibility, type ColumnVisibility } from '../use-column-visibility';

const STORAGE_KEY = 'segments-column-visibility';

describe('useColumnVisibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns all columns visible by default', () => {
    const { result } = renderHook(() => useColumnVisibility());

    expect(result.current.visibility).toEqual({
      lastCountEmail: true,
      lastCountWebPush: true,
      lastCountMobilePush: true,
      lastCountPhone: true,
      lastCountWhatsapp: true,
    });
  });

  it('loads persisted visibility from localStorage', () => {
    const stored: ColumnVisibility = {
      lastCountEmail: true,
      lastCountWebPush: false,
      lastCountMobilePush: true,
      lastCountPhone: false,
      lastCountWhatsapp: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useColumnVisibility());

    expect(result.current.visibility.lastCountWebPush).toBe(false);
    expect(result.current.visibility.lastCountPhone).toBe(false);
    expect(result.current.visibility.lastCountEmail).toBe(true);
  });

  it('updates visibility and persists to localStorage', () => {
    const { result } = renderHook(() => useColumnVisibility());

    act(() => {
      result.current.updateVisibility({
        ...result.current.visibility,
        lastCountEmail: false,
        lastCountWhatsapp: false,
      });
    });

    expect(result.current.visibility.lastCountEmail).toBe(false);
    expect(result.current.visibility.lastCountWhatsapp).toBe(false);

    // Verify localStorage was updated
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.lastCountEmail).toBe(false);
    expect(stored.lastCountWhatsapp).toBe(false);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');

    const { result } = renderHook(() => useColumnVisibility());

    // Should fall back to defaults
    expect(result.current.visibility.lastCountEmail).toBe(true);
    expect(result.current.visibility.lastCountWebPush).toBe(true);
  });

  it('handles partial localStorage data by merging with defaults', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lastCountEmail: false }));

    const { result } = renderHook(() => useColumnVisibility());

    expect(result.current.visibility.lastCountEmail).toBe(false);
    // Missing keys should default to true
    expect(result.current.visibility.lastCountWebPush).toBe(true);
    expect(result.current.visibility.lastCountMobilePush).toBe(true);
  });
});
