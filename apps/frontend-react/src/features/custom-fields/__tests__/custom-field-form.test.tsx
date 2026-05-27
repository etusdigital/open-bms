// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@/lib/i18n';
import { CustomFieldForm } from '../custom-field-form';

vi.mock('@tanstack/react-router', () => ({
  useBlocker: vi.fn().mockReturnValue({ status: 'idle' }),
}));

// Radix Select uses scrollIntoView which isn't available in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('CustomFieldForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    isPending: false,
  };

  it('renders title, description, and type fields', () => {
    render(<CustomFieldForm {...defaultProps} />);
    expect(screen.getByLabelText(/título/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descrição/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tipo/i)).toBeInTheDocument();
  });

  it('shows "Criar" button in create mode', () => {
    render(<CustomFieldForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
  });

  it('shows "Salvar" button in edit mode', () => {
    render(
      <CustomFieldForm {...defaultProps} defaultValues={{ title: 'Existing', description: 'Desc', type: 'text' }} />,
    );
    expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
  });

  it('pre-fills form with defaultValues in edit mode', () => {
    render(
      <CustomFieldForm
        {...defaultProps}
        defaultValues={{ title: 'Color', description: 'Favorite color', type: 'text' }}
      />,
    );
    expect(screen.getByDisplayValue('Color')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Favorite color')).toBeInTheDocument();
  });

  it('shows character counters for title and description', () => {
    render(<CustomFieldForm {...defaultProps} />);
    expect(screen.getByText('0/40')).toBeInTheDocument();
    expect(screen.getByText('0/255')).toBeInTheDocument();
  });

  it('updates character counter as user types', () => {
    render(<CustomFieldForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Hello' } });
    expect(screen.getByText('5/40')).toBeInTheDocument();
  });

  it('disables submit button when isPending', () => {
    render(<CustomFieldForm {...defaultProps} isPending />);
    expect(screen.getByRole('button', { name: /carregando/i })).toBeDisabled();
  });

  it('calls onSubmit with form data on valid submission', async () => {
    const onSubmit = vi.fn();

    render(
      <CustomFieldForm
        {...defaultProps}
        onSubmit={onSubmit}
        defaultValues={{ title: '', description: '', type: 'date' }}
      />,
    );

    fireEvent.change(screen.getByLabelText(/título/i), {
      target: { value: 'Birthday' },
    });
    fireEvent.change(screen.getByLabelText(/descrição/i), {
      target: { value: 'Date of birth' },
    });

    fireEvent.submit(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { title: 'Birthday', description: 'Date of birth', type: 'date' },
        expect.anything(),
      );
    });
  });

  it('shows validation error when title is empty', async () => {
    render(<CustomFieldForm {...defaultProps} />);

    fireEvent.submit(screen.getByRole('button', { name: /criar/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/obrigatório/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });
});
