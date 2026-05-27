import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import SettingsPage from '../settings-page';

const mockMutate = vi.fn();

vi.mock('../use-settings', () => ({
  useAccountConfig: (name: string) => {
    const configs: Record<string, string> = {
      api_key: 'test-api-key',
      api_key_tracker: 'test-tracker-key',
      unsubscribe_redirect_url: 'https://example.com/unsub',
      default_domain: 'example.com',
      send_limit_per_user: '1000',
      default_email_provider: 'mailersend',
    };
    return configs[name] ?? '';
  },
  useAccountConfigs: () => [],
  useAccountId: () => 1,
  useTimezone: () => 'America/Sao_Paulo',
  useUpdateAccountConfigs: () => ({ mutate: mockMutate, isPending: false }),
}));

vi.mock('../email-providers/use-email-providers', () => ({
  useEmailProviders: () => ({
    providers: [
      { name: 'sendgrid', label: 'SendGrid', configured: false, hasFreeTier: false, hasWebhook: true },
      { name: 'mailersend', label: 'MailerSend', configured: false, hasFreeTier: true, hasWebhook: true },
      { name: 'sparkpost', label: 'SparkPost', configured: false, hasFreeTier: true, hasWebhook: true },
      { name: 'resend', label: 'Resend', configured: false, hasFreeTier: true, hasWebhook: true },
      { name: 'ses', label: 'Amazon SES', configured: false, hasFreeTier: false, hasWebhook: true },
      { name: 'mandrill', label: 'Mandrill', configured: false, hasFreeTier: false, hasWebhook: true },
    ],
    configuredProviders: [],
    hasAnyConfigured: false,
    defaultProvider: 'mailersend',
    isLoading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('../email-providers/sparkpost-legacy-migration', () => ({
  SparkpostLegacyMigration: () => null,
}));

vi.mock('../email-providers/sendgrid-account-gateway', () => ({
  accountSendgridGateway: {
    get: vi.fn().mockResolvedValue({ source: 'none', apiKeyMasked: null, webhookUrl: null }),
    save: vi.fn(),
    remove: vi.fn(),
    test: vi.fn(),
  },
}));

vi.mock('../email-providers/mailersend-account-gateway', () => ({
  accountMailersendGateway: {
    get: vi.fn().mockResolvedValue({ source: 'none', apiKeyMasked: null }),
    save: vi.fn(),
    remove: vi.fn(),
    test: vi.fn(),
  },
}));

vi.mock('../email-providers/sparkpost-account-gateway', () => ({
  accountSparkpostGateway: {
    get: vi.fn().mockResolvedValue({ source: 'none', apiKeyMasked: null }),
    save: vi.fn(),
    remove: vi.fn(),
    test: vi.fn(),
  },
}));

vi.mock('../email-providers/resend-account-gateway', () => ({
  accountResendGateway: {
    get: vi.fn().mockResolvedValue({ source: 'none', apiKeyMasked: null }),
    save: vi.fn(),
    remove: vi.fn(),
    test: vi.fn(),
  },
}));

vi.mock('../email-providers/amazon-ses-account-gateway', () => ({
  accountSesGateway: {
    get: vi.fn().mockResolvedValue({ source: 'none', accessKeyIdMasked: null, secretAccessKeyMasked: null, region: null }),
    save: vi.fn(),
    remove: vi.fn(),
    test: vi.fn(),
  },
}));

vi.mock('../email-providers/mandrill-account-gateway', () => ({
  accountMandrillGateway: {
    get: vi.fn().mockResolvedValue({ source: 'none', apiKeyMasked: null }),
    save: vi.fn(),
    remove: vi.fn(),
    test: vi.fn(),
  },
}));

function renderPage() {
  return renderWithRouter(<SettingsPage />);
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  describe('general tab', () => {
    it('renders the page title', async () => {
      await renderPage();
      expect(screen.getByText('Configurações')).toBeInTheDocument();
    });

    it('shows general tab by default', async () => {
      await renderPage();
      expect(screen.getByDisplayValue('test-api-key')).toBeInTheDocument();
    });

    it('shows API key tracker', async () => {
      await renderPage();
      expect(screen.getByDisplayValue('test-tracker-key')).toBeInTheDocument();
    });

    it('shows timezone', async () => {
      await renderPage();
      expect(screen.getByDisplayValue('America/Sao_Paulo')).toBeInTheDocument();
    });

    it('shows tab buttons', async () => {
      await renderPage();
      expect(screen.getByRole('button', { name: 'Geral' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Email' })).toBeInTheDocument();
    });
  });

  describe('email tab', () => {
    it('shows email rate limit field when switching tabs', async () => {
      await renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Email' }));

      expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    });

    it('shows save button on email tab', async () => {
      await renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Email' }));

      expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
    });

    it('submits email settings', async () => {
      await renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Email' }));

      const saveButton = screen.getByRole('button', { name: /salvar/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          accountId: 1,
          configs: [{ account_id: 1, name: 'send_limit_per_user', value: '1000' }],
        });
      });
    });
  });

  describe('email providers tab', () => {
    it('shows the email providers tab button', async () => {
      await renderPage();
      expect(screen.getByRole('button', { name: 'Email Providers' })).toBeInTheDocument();
    });

    it('switches to email providers tab and renders the listing CTA', async () => {
      await renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Email Providers' }));
      await waitFor(() => {
        expect(screen.getByTestId('add-provider-cta')).toBeInTheDocument();
      });
    });
  });
});
