// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@/lib/i18n';

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
    warning: vi.fn(),
  },
}));

vi.mock('../../use-settings', () => ({
  useAccountId: () => 42,
}));

const gatewayGet = vi.fn();
const gatewaySave = vi.fn();
const gatewayRemove = vi.fn();
const gatewayTest = vi.fn();

vi.mock('../sendgrid-account-gateway', () => ({
  accountSendgridGateway: {
    get: (...args: unknown[]) => gatewayGet(...args),
    save: (...args: unknown[]) => gatewaySave(...args),
    remove: (...args: unknown[]) => gatewayRemove(...args),
    test: (...args: unknown[]) => gatewayTest(...args),
  },
}));

import { SendgridCard } from '../sendgrid-card';

describe('SendgridCard', () => {
  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
    gatewayGet.mockReset();
    gatewaySave.mockReset();
    gatewayRemove.mockReset();
    gatewayTest.mockReset();
  });

  it('renders the API key input + helper in not-configured state and no webhook footer', async () => {
    gatewayGet.mockResolvedValue({ source: 'none', apiKeyMasked: null, webhookUrl: null });
    render(<SendgridCard />);
    await waitFor(() => screen.getByPlaceholderText(/SG\./));
    expect(screen.getByPlaceholderText(/SG\./)).toBeInTheDocument();
    expect(screen.queryByTestId('sendgrid-webhook-footer')).not.toBeInTheDocument();
  });

  it('renders the masked key + webhook footer when configured, and copy writes to clipboard', async () => {
    gatewayGet.mockResolvedValue({
      source: 'account',
      apiKeyMasked: 'SG.***xyz',
      webhookUrl: 'https://bms.example.com/sg-events?account=42',
    });
    const writeText = vi.fn();
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<SendgridCard />);
    await waitFor(() => screen.getByText('SG.***xyz'));
    const footer = await screen.findByTestId('sendgrid-webhook-footer');
    expect(footer).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://bms.example.com/sg-events?account=42')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Copiar webhook/i }));
    expect(writeText).toHaveBeenCalledWith('https://bms.example.com/sg-events?account=42');
  });
});
