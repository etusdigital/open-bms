// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@/lib/i18n';
import { LabelForm } from '../label-form';

vi.mock('@tanstack/react-router', () => ({
  useBlocker: vi.fn().mockReturnValue({ status: 'idle' }),
}));

describe('LabelForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    isPending: false,
  };

  it('renders name and description fields', () => {
    render(<LabelForm {...defaultProps} />);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descrição/i)).toBeInTheDocument();
  });

  it('shows "Criar" button in create mode', () => {
    render(<LabelForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
  });

  it('shows "Salvar" button in edit mode', () => {
    render(<LabelForm {...defaultProps} defaultValues={{ name: 'Existing', description: 'Desc' }} />);
    expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
  });

  it('pre-fills form with defaultValues in edit mode', () => {
    render(<LabelForm {...defaultProps} defaultValues={{ name: 'My Label', description: 'My description' }} />);
    expect(screen.getByDisplayValue('My Label')).toBeInTheDocument();
    expect(screen.getByDisplayValue('My description')).toBeInTheDocument();
  });

  it('shows character counters for name and description', () => {
    render(<LabelForm {...defaultProps} />);
    expect(screen.getByText('0/100')).toBeInTheDocument();
    expect(screen.getByText('0/255')).toBeInTheDocument();
  });

  it('updates character counter as user types', () => {
    render(<LabelForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Hello' } });
    expect(screen.getByText('5/100')).toBeInTheDocument();
  });

  it('disables submit button when isPending', () => {
    render(<LabelForm {...defaultProps} isPending />);
    expect(screen.getByRole('button', { name: /carregando/i })).toBeDisabled();
  });

  it('calls onSubmit with form data on valid submission', async () => {
    const onSubmit = vi.fn();

    render(<LabelForm {...defaultProps} onSubmit={onSubmit} defaultValues={{ name: '', description: '' }} />);

    fireEvent.change(screen.getByLabelText(/nome/i), {
      target: { value: 'New Label' },
    });
    fireEvent.change(screen.getByLabelText(/descrição/i), {
      target: { value: 'A description' },
    });

    fireEvent.submit(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: 'New Label', description: 'A description' }, expect.anything());
    });
  });

  it('shows validation error when name is empty', async () => {
    render(<LabelForm {...defaultProps} />);

    fireEvent.submit(screen.getByRole('button', { name: /criar/i }));

    await waitFor(() => {
      expect(screen.getByText(/obrigatório/i)).toBeInTheDocument();
    });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });
});
