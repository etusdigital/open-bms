// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@/lib/i18n';
import { CustomEventForm } from '../custom-event-form';

vi.mock('@tanstack/react-router', () => ({
  useBlocker: vi.fn().mockReturnValue({ status: 'idle' }),
}));

describe('CustomEventForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    isPending: false,
  };

  it('renders name and description fields', () => {
    render(<CustomEventForm {...defaultProps} />);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descrição/i)).toBeInTheDocument();
  });

  it('shows "Criar" button in create mode', () => {
    render(<CustomEventForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
  });

  it('shows "Salvar" button in edit mode', () => {
    render(<CustomEventForm {...defaultProps} defaultValues={{ name: 'Existing', description: 'Desc' }} />);
    expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
  });

  it('pre-fills form with defaultValues in edit mode', () => {
    render(<CustomEventForm {...defaultProps} defaultValues={{ name: 'page_view', description: 'Page viewed' }} />);
    expect(screen.getByDisplayValue('page_view')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Page viewed')).toBeInTheDocument();
  });

  it('shows character counters for name and description', () => {
    render(<CustomEventForm {...defaultProps} />);
    expect(screen.getByText('0/40')).toBeInTheDocument();
    expect(screen.getByText('0/500')).toBeInTheDocument();
  });

  it('updates character counter as user types', () => {
    render(<CustomEventForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Hello' } });
    expect(screen.getByText('5/40')).toBeInTheDocument();
  });

  it('disables submit button when isPending', () => {
    render(<CustomEventForm {...defaultProps} isPending />);
    expect(screen.getByRole('button', { name: /carregando/i })).toBeDisabled();
  });

  it('disables fields when isDefault', () => {
    render(<CustomEventForm {...defaultProps} defaultValues={{ name: 'Default Event', description: '' }} isDefault />);
    expect(screen.getByLabelText(/nome/i)).toBeDisabled();
    expect(screen.getByLabelText(/descrição/i)).toBeDisabled();
  });

  it('calls onSubmit with form data on valid submission', async () => {
    const onSubmit = vi.fn();

    render(<CustomEventForm {...defaultProps} onSubmit={onSubmit} defaultValues={{ name: '', description: '' }} />);

    fireEvent.change(screen.getByLabelText(/nome/i), {
      target: { value: 'signup' },
    });

    fireEvent.submit(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: 'signup', description: '' }, expect.anything());
    });
  });

  it('shows validation error when name is empty', async () => {
    render(<CustomEventForm {...defaultProps} />);

    fireEvent.submit(screen.getByRole('button', { name: /criar/i }));

    await waitFor(() => {
      expect(screen.getByText(/obrigatório/i)).toBeInTheDocument();
    });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });
});
