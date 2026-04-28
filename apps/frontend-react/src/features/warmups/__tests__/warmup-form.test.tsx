// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@/lib/i18n';
import { WarmupForm } from '../warmup-form';

vi.mock('@tanstack/react-router', () => ({
  useBlocker: vi.fn().mockReturnValue({ status: 'idle' }),
}));

vi.mock('../use-accounts-list', () => ({
  useAccountsList: () => [
    { value: '1', label: 'Account Alpha' },
    { value: '2', label: 'Account Beta' },
  ],
}));

vi.mock('../use-pools-by-account', () => ({
  usePoolsByAccount: (accountId: number) => ({
    data:
      accountId > 0
        ? [
            {
              id: 10,
              poolName: 'pool-a',
              senderEmail: 'a@test.com',
              senderReplyTo: 'reply-a@test.com',
            },
            { id: 20, poolName: 'pool-b', senderEmail: 'b@test.com', senderReplyTo: null },
          ]
        : undefined,
    isLoading: false,
  }),
}));

vi.mock('../use-segments-by-account', () => ({
  useSegmentsByAccount: (accountId: number) => ({
    data:
      accountId > 0
        ? [
            { id: 100, name: 'Active Users' },
            { id: 200, name: 'New Signups' },
          ]
        : undefined,
    isLoading: false,
  }),
}));

vi.mock('@/components/charts/echarts-base', () => ({
  EChartsBase: ({ height }: { height: number }) => <div data-testid="echarts-container" style={{ height }} />,
}));

describe('WarmupForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    isPending: false,
  };

  it('renders account selection dropdowns', () => {
    render(<WarmupForm {...defaultProps} />);
    expect(screen.getByText(/conta base/i)).toBeInTheDocument();
    expect(screen.getByText(/conta destino/i)).toBeInTheDocument();
  });

  it('renders pool dropdown', () => {
    render(<WarmupForm {...defaultProps} />);
    // "Pool" label exists (exact text from i18n)
    expect(screen.getAllByText(/pool/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders target configuration', () => {
    render(<WarmupForm {...defaultProps} />);
    expect(screen.getByText(/meta diária/i)).toBeInTheDocument();
  });

  it('renders internal warmup checkbox', () => {
    render(<WarmupForm {...defaultProps} />);
    expect(screen.getByText(/warmup interno/i)).toBeInTheDocument();
  });

  it('renders description field with character counter', () => {
    render(<WarmupForm {...defaultProps} />);
    expect(screen.getByText(/descrição/i)).toBeInTheDocument();
    expect(screen.getByText('0/255')).toBeInTheDocument();
  });

  it('shows "Criar" button in create mode', () => {
    render(<WarmupForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
  });

  it('shows "Salvar" button in edit mode', () => {
    render(
      <WarmupForm
        {...defaultProps}
        defaultValues={{
          accountId: 1,
          targetAccountId: 2,
          sender: 'a@b.com',
          ippool: 'main',
          replyTo: '',
          target: 1000,
          type: 'internal',
          stage: 1,
          description: '',
        }}
      />,
    );
    expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
  });

  it('pre-fills description in edit mode', () => {
    render(
      <WarmupForm
        {...defaultProps}
        defaultValues={{
          accountId: 1,
          targetAccountId: 2,
          sender: 'test@example.com',
          ippool: 'main-pool',
          replyTo: 'reply@example.com',
          target: 10000,
          type: 'internal',
          stage: 1,
          description: 'Test warmup',
        }}
      />,
    );
    // sender/ippool are hidden (set via pool selection), only description is visible
    expect(screen.getByDisplayValue('Test warmup')).toBeInTheDocument();
  });

  it('does not render sender, ippool, or replyTo input fields', () => {
    render(<WarmupForm {...defaultProps} />);
    expect(screen.queryByLabelText(/remetente/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ip pool/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/reply-to/i)).not.toBeInTheDocument();
  });

  it('renders segment select label', () => {
    render(<WarmupForm {...defaultProps} />);
    expect(screen.getByText(/segmento/i)).toBeInTheDocument();
  });

  it('renders cancel button', () => {
    render(<WarmupForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<WarmupForm {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables submit button when isPending', () => {
    render(<WarmupForm {...defaultProps} isPending />);
    expect(screen.getByRole('button', { name: /carregando/i })).toBeDisabled();
  });

  it('renders warmup preview chart', () => {
    render(<WarmupForm {...defaultProps} />);
    expect(screen.getByTestId('echarts-container')).toBeInTheDocument();
  });
});
