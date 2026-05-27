// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../theme';

// Helper component that exposes theme controls
let themeAPI: ReturnType<typeof useTheme>;

function ThemeConsumer() {
  themeAPI = useTheme();
  return <div data-testid="consumer" />;
}

function renderWithProvider() {
  return render(
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>,
  );
}

// Mock matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to system theme', () => {
    renderWithProvider();
    expect(themeAPI.theme).toBe('system');
  });

  it('adds .dark class to <html> when set to dark', () => {
    renderWithProvider();

    act(() => {
      themeAPI.setTheme('dark');
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes .dark class from <html> when set to light', () => {
    document.documentElement.classList.add('dark');
    renderWithProvider();

    act(() => {
      themeAPI.setTheme('light');
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists theme choice to localStorage', () => {
    renderWithProvider();

    act(() => {
      themeAPI.setTheme('dark');
    });

    expect(localStorage.getItem('bms-theme')).toBe('dark');
  });

  it('restores theme from localStorage on mount', () => {
    localStorage.setItem('bms-theme', 'dark');
    renderWithProvider();

    expect(themeAPI.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('resolvedTheme reflects the actual applied theme', () => {
    renderWithProvider();

    act(() => {
      themeAPI.setTheme('dark');
    });
    expect(themeAPI.resolvedTheme).toBe('dark');

    act(() => {
      themeAPI.setTheme('light');
    });
    expect(themeAPI.resolvedTheme).toBe('light');
  });
});
