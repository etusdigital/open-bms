// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/lib/i18n';
import { ContactEditDialog } from '../contact-edit-dialog';

vi.mock('@tanstack/react-router', () => ({
  useBlocker: vi.fn().mockReturnValue({ status: 'idle' }),
}));

// Suppress known Radix Dialog accessibility warning about missing Description
const originalWarn = console.warn;

describe('ContactEditDialog', () => {
  beforeEach(() => {
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('Missing `Description`')) return;
      originalWarn(...args);
    };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    isPending: false,
    defaultValues: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+5511999999999',
      city: 'São Paulo',
      region: 'SP',
      country: 'Brazil',
      isActive: true,
    },
  };

  it('renders form fields when open', () => {
    render(<ContactEditDialog {...defaultProps} />);
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
  });

  it('renders phone field', () => {
    render(<ContactEditDialog {...defaultProps} />);
    expect(screen.getByDisplayValue('+5511999999999')).toBeInTheDocument();
  });

  it('renders location fields', () => {
    render(<ContactEditDialog {...defaultProps} />);
    expect(screen.getByDisplayValue('São Paulo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SP')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Brazil')).toBeInTheDocument();
  });

  it('shows save button', () => {
    render(<ContactEditDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
  });

  it('disables save button when pending', () => {
    render(<ContactEditDialog {...defaultProps} isPending />);
    expect(screen.getByRole('button', { name: /carregando/i })).toBeDisabled();
  });
});
