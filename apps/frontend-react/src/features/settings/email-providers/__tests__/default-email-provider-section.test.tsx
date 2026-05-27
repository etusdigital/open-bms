// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import '@/lib/i18n';

const mockMutate = vi.fn();
vi.mock('../../use-settings', () => ({
  useAccountId: () => 42,
  useUpdateAccountConfigs: () => ({ mutate: mockMutate, isPending: false }),
}));

const mockUseEmailProviders = vi.fn();
vi.mock('../use-email-providers', () => ({
  useEmailProviders: () => mockUseEmailProviders(),
}));

import { DefaultEmailProviderSection } from '../default-email-provider-section';

function renderSection() {
  return render(<DefaultEmailProviderSection />, { wrapper: createQueryWrapper() });
}

const ALL_CONFIGURED = [
  { name: 'sendgrid', label: 'SendGrid', configured: true, hasFreeTier: false, hasWebhook: true },
  { name: 'mailersend', label: 'MailerSend', configured: true, hasFreeTier: true, hasWebhook: true },
  { name: 'sparkpost', label: 'SparkPost', configured: true, hasFreeTier: true, hasWebhook: true },
  { name: 'resend', label: 'Resend', configured: true, hasFreeTier: true, hasWebhook: true },
  { name: 'ses', label: 'Amazon SES', configured: true, hasFreeTier: false, hasWebhook: true },
  { name: 'mandrill', label: 'Mandrill', configured: true, hasFreeTier: false, hasWebhook: true },
];

describe('DefaultEmailProviderSection', () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockUseEmailProviders.mockReset();
  });

  it('renders all 6 provider options including SendGrid', async () => {
    mockUseEmailProviders.mockReturnValue({ providers: ALL_CONFIGURED, defaultProvider: '', isLoading: false, refresh: vi.fn() });
    renderSection();
    expect(screen.getByText('SendGrid')).toBeInTheDocument();
    expect(screen.getByText('MailerSend')).toBeInTheDocument();
    expect(screen.getByText('SparkPost')).toBeInTheDocument();
    expect(screen.getByText('Resend')).toBeInTheDocument();
    expect(screen.getByText('Amazon SES')).toBeInTheDocument();
    expect(screen.getByText('Mandrill')).toBeInTheDocument();
  });

  it('disables radio for non-configured providers', async () => {
    const providers = ALL_CONFIGURED.map((p) => (p.name === 'mandrill' ? { ...p, configured: false } : p));
    mockUseEmailProviders.mockReturnValue({ providers, defaultProvider: '', isLoading: false, refresh: vi.fn() });
    renderSection();
    const radios = screen.getAllByRole('radio');
    const mandrillRadio = radios.find((el) => el.textContent?.includes('Mandrill'));
    expect(mandrillRadio).toBeDisabled();
  });

  it('renders SES warning banner when SES is selected', async () => {
    mockUseEmailProviders.mockReturnValue({ providers: ALL_CONFIGURED, defaultProvider: '', isLoading: false, refresh: vi.fn() });
    renderSection();
    fireEvent.click(screen.getByRole('radio', { name: /Amazon SES/i }));
    await waitFor(() => expect(screen.getByTestId('default-provider-ses-warning')).toBeInTheDocument());
  });

  it('renders Mandrill warning banner when Mandrill is selected', async () => {
    mockUseEmailProviders.mockReturnValue({ providers: ALL_CONFIGURED, defaultProvider: '', isLoading: false, refresh: vi.fn() });
    renderSection();
    fireEvent.click(screen.getByRole('radio', { name: /Mandrill/i }));
    await waitFor(() => expect(screen.getByTestId('default-provider-mandrill-warning')).toBeInTheDocument());
  });

  it('calls updateConfigs.mutate on Save with selected provider', async () => {
    mockUseEmailProviders.mockReturnValue({ providers: ALL_CONFIGURED, defaultProvider: '', isLoading: false, refresh: vi.fn() });
    renderSection();
    fireEvent.click(screen.getByRole('radio', { name: /SparkPost/i }));
    fireEvent.click(screen.getByRole('button', { name: /Salvar default|Save default/i }));
    await waitFor(() =>
      expect(mockMutate).toHaveBeenCalledWith({
        accountId: 42,
        configs: [{ account_id: 42, name: 'default_email_provider', value: 'sparkpost' }],
      }),
    );
  });
});
