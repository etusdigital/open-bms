// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'common.loading': 'Carregando...',
      };
      return map[key] || key;
    },
  }),
}));

import { LoadingScreen } from '../loading-screen';

describe('LoadingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders logo.png image', () => {
    render(<LoadingScreen />);
    const img = screen.getByAltText('BMS');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('/logo.png');
  });

  it('shows translated loading text by default', () => {
    render(<LoadingScreen />);
    expect(screen.getByText('Carregando...')).toBeDefined();
  });

  it('shows custom message when provided', () => {
    render(<LoadingScreen message="Conectando..." />);
    expect(screen.getByText('Conectando...')).toBeDefined();
  });

  it('has bg-background class for theme support', () => {
    const { container } = render(<LoadingScreen />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('bg-background');
  });

  it('renders a spinner', () => {
    const { container } = render(<LoadingScreen />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
  });
});
