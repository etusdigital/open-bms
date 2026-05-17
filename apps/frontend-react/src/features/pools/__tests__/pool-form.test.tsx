// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@/lib/i18n';
import { PoolForm } from '../pool-form';

vi.mock('@tanstack/react-router', () => ({
  useBlocker: vi.fn().mockReturnValue({ status: 'idle' }),
}));

describe('PoolForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    isPending: false,
  };

  it('renders basic info fields', () => {
    render(<PoolForm {...defaultProps} />);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descrição/i)).toBeInTheDocument();
  });

  // EVO-1281: sender identity moved out of the pool form — the pools
  // feature is now IP-pool-only (no senderName/senderEmail/senderReplyTo).
  it('does not render sender identity fields', () => {
    render(<PoolForm {...defaultProps} />);
    expect(screen.queryByLabelText(/sender name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/sender email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/reply.to/i)).not.toBeInTheDocument();
  });

  it('renders pool configuration fields when SendGrid has dedicated pools', () => {
    render(<PoolForm {...defaultProps} sendGridPools={[{ name: 'pool-a' }]} />);
    expect(screen.getByText(/nome do pool/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/daily limit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sending limit/i)).toBeInTheDocument();
  });

  it('replaces the pool dropdown with a Free-plan callout when SendGrid has no pools', () => {
    render(<PoolForm {...defaultProps} sendGridPools={[]} />);
    expect(screen.getByText(/Free\/Essentials/i)).toBeInTheDocument();
    // limits remain editable so the user can still save the IP pool
    expect(screen.getByLabelText(/daily limit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sending limit/i)).toBeInTheDocument();
  });

  it('shows "Criar" button in create mode', () => {
    render(<PoolForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
  });

  it('shows "Salvar" button in edit mode', () => {
    render(
      <PoolForm
        {...defaultProps}
        defaultValues={{
          name: 'Existing',
          description: '',
          poolName: 'existing-pool',
          isDefault: false,
          ip: '',
          dailyLimit: '0',
          sendingLimit: '0',
        }}
      />,
    );
    expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
  });

  it('pre-fills form with defaultValues in edit mode', () => {
    render(
      <PoolForm
        {...defaultProps}
        defaultValues={{
          name: 'Main Pool',
          description: 'Primary pool',
          poolName: 'main',
          isDefault: false,
          ip: '',
          dailyLimit: '1000',
          sendingLimit: '100',
        }}
      />,
    );
    expect(screen.getByDisplayValue('Main Pool')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Primary pool')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });

  it('shows character counters for name and description', () => {
    render(<PoolForm {...defaultProps} />);
    expect(screen.getByText('0/40')).toBeInTheDocument();
    expect(screen.getByText('0/255')).toBeInTheDocument();
  });

  it('disables submit button when isPending', () => {
    render(<PoolForm {...defaultProps} isPending />);
    expect(screen.getByRole('button', { name: /carregando/i })).toBeDisabled();
  });

  it('renders SendGrid pool options when provided', () => {
    render(<PoolForm {...defaultProps} sendGridPools={[{ name: 'pool-a' }, { name: 'pool-b' }]} />);
    // The select trigger should be present
    expect(screen.getByText(/selecione/i)).toBeInTheDocument();
  });

  it('shows validation error when name is empty on submit', async () => {
    render(<PoolForm {...defaultProps} />);

    fireEvent.submit(screen.getByRole('button', { name: /criar/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/obrigatório/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });
});
