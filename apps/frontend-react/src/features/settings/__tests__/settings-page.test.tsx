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
    };
    return configs[name] ?? '';
  },
  useAccountConfigs: () => [],
  useAccountId: () => 1,
  useTimezone: () => 'America/Sao_Paulo',
  useUpdateAccountConfigs: () => ({ mutate: mockMutate, isPending: false }),
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
});
