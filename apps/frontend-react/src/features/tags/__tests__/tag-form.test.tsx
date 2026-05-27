// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@/lib/i18n';
import { TagForm } from '../tag-form';

vi.mock('@tanstack/react-router', () => ({
  useBlocker: vi.fn().mockReturnValue({ status: 'idle' }),
}));

describe('TagForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    isPending: false,
  };

  it('renders name and description fields', () => {
    render(<TagForm {...defaultProps} />);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descrição/i)).toBeInTheDocument();
  });

  it('shows "Criar" button in create mode', () => {
    render(<TagForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
  });

  it('shows "Salvar" button in edit mode', () => {
    render(<TagForm {...defaultProps} defaultValues={{ name: 'Existing', description: 'Desc' }} />);
    expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
  });

  it('pre-fills form with defaultValues in edit mode', () => {
    render(<TagForm {...defaultProps} defaultValues={{ name: 'My Tag', description: 'My Desc' }} />);
    expect(screen.getByDisplayValue('My Tag')).toBeInTheDocument();
    expect(screen.getByDisplayValue('My Desc')).toBeInTheDocument();
  });

  it('shows character counters for name and description', () => {
    render(<TagForm {...defaultProps} />);
    expect(screen.getByText('0/40')).toBeInTheDocument();
    expect(screen.getByText('0/500')).toBeInTheDocument();
  });

  it('updates character counter as user types', () => {
    render(<TagForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Hello' } });
    expect(screen.getByText('5/40')).toBeInTheDocument();
  });

  it('disables submit button when isPending', () => {
    render(<TagForm {...defaultProps} isPending />);
    expect(screen.getByRole('button', { name: /carregando/i })).toBeDisabled();
  });

  it('calls onSubmit with form data on valid submission', async () => {
    const onSubmit = vi.fn();

    render(<TagForm {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/nome/i), {
      target: { value: 'New Tag' },
    });
    fireEvent.change(screen.getByLabelText(/descrição/i), {
      target: { value: 'A description' },
    });

    fireEvent.submit(screen.getByRole('button', { name: /criar/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: 'New Tag', description: 'A description' }, expect.anything());
    });
  });

  it('shows validation error when name is empty', async () => {
    render(<TagForm {...defaultProps} />);

    fireEvent.submit(screen.getByRole('button', { name: /criar/i }));

    await waitFor(() => {
      expect(screen.getByText(/obrigatório/i)).toBeInTheDocument();
    });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });
});
