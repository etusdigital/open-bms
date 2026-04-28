// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/lib/i18n';
import { SegmentForm } from '../segment-form';

vi.mock('@tanstack/react-router', () => ({
  useBlocker: vi.fn().mockReturnValue({ status: 'idle' }),
}));

describe('SegmentForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    isPending: false,
  };

  it('renders name and description fields', () => {
    render(<SegmentForm {...defaultProps} />);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descrição/i)).toBeInTheDocument();
  });

  it('renders contactsLimit field', () => {
    render(<SegmentForm {...defaultProps} />);
    expect(screen.getByLabelText(/limitar audiência|limit audience/i)).toBeInTheDocument();
  });

  it('does not render hidden API-managed fields', () => {
    render(<SegmentForm {...defaultProps} />);
    expect(screen.queryByLabelText(/recorrência/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/incluir bounced/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/incluir descadastrados/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/incluir inválidos/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/tempo real/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/clickhouse/i)).not.toBeInTheDocument();
  });

  it('shows "Criar" button in create mode', () => {
    render(<SegmentForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
  });

  it('shows "Salvar" button in edit mode', () => {
    render(
      <SegmentForm
        {...defaultProps}
        defaultValues={{
          name: 'Test',
          description: '',
          contactsLimit: 0,
          recurrence: 24,
          addBounced: false,
          addUnsubscribed: false,
          addInvalid: false,
          isRealTimeSegment: false,
          steps: '[]',
        }}
      />,
    );
    expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
  });

  it('pre-fills form with defaultValues in edit mode', () => {
    render(
      <SegmentForm
        {...defaultProps}
        defaultValues={{
          name: 'Active Users',
          description: 'Users active in last 30 days',
          contactsLimit: 100,
          recurrence: 48,
          addBounced: true,
          addUnsubscribed: false,
          addInvalid: false,
          isRealTimeSegment: false,
          steps: '[]',
        }}
      />,
    );
    expect(screen.getByDisplayValue('Active Users')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Users active in last 30 days')).toBeInTheDocument();
  });

  it('shows character counter for name and description', () => {
    render(<SegmentForm {...defaultProps} />);
    expect(screen.getByText('0/40')).toBeInTheDocument();
    expect(screen.getByText('0/500')).toBeInTheDocument();
  });

  it('disables submit button when isPending', () => {
    render(<SegmentForm {...defaultProps} isPending />);
    expect(screen.getByRole('button', { name: /carregando/i })).toBeDisabled();
  });
});
