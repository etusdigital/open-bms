// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

const refresh = vi.fn();
vi.mock('../use-email-providers', () => ({
  useEmailProviders: () => ({ refresh }),
}));

const apiClientGet = vi.fn();
const apiClientPost = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => apiClientGet(...args),
    post: (...args: unknown[]) => apiClientPost(...args),
  },
}));

import { SparkpostLegacyMigration } from '../sparkpost-legacy-migration';

function renderWithProviders() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SparkpostLegacyMigration />
    </QueryClientProvider>,
  );
}

describe('SparkpostLegacyMigration', () => {
  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
    apiClientGet.mockReset();
    apiClientPost.mockReset();
    refresh.mockReset();
    try {
      window.sessionStorage.clear();
    } catch {
      /* noop */
    }
  });

  it('renders nothing when legacy not detected', async () => {
    apiClientGet.mockResolvedValue({
      data: { legacyDetected: false, envValuePresent: false, perAccountConfigured: false },
    });
    renderWithProviders();
    await waitFor(() => expect(apiClientGet).toHaveBeenCalled());
    expect(screen.queryByTestId('sparkpost-legacy-migration-dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog when legacy detected', async () => {
    apiClientGet.mockResolvedValue({
      data: { legacyDetected: true, envValuePresent: true, perAccountConfigured: false },
    });
    renderWithProviders();
    expect(await screen.findByTestId('sparkpost-legacy-migration-dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Migrar agora/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manter como está/i })).toBeInTheDocument();
  });

  it('clicking "Migrar agora" calls POST + refresh and shows success toast', async () => {
    apiClientGet.mockResolvedValue({
      data: { legacyDetected: true, envValuePresent: true, perAccountConfigured: false },
    });
    apiClientPost.mockResolvedValue({
      data: { legacyDetected: false, envValuePresent: true, perAccountConfigured: true },
    });

    renderWithProviders();
    fireEvent.click(await screen.findByRole('button', { name: /Migrar agora/i }));

    await waitFor(() =>
      expect(apiClientPost).toHaveBeenCalledWith('/accounts/42/settings/sparkpost/migrate-legacy'),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('clicking "Manter como está" persists sessionStorage dismiss key', async () => {
    apiClientGet.mockResolvedValue({
      data: { legacyDetected: true, envValuePresent: true, perAccountConfigured: false },
    });

    renderWithProviders();
    fireEvent.click(await screen.findByRole('button', { name: /Manter como está/i }));
    expect(window.sessionStorage.getItem('email-providers:sparkpost-legacy-dismissed:42')).toBe('1');
  });

  it('renders nothing when dismissed in sessionStorage even if legacy detected', async () => {
    window.sessionStorage.setItem('email-providers:sparkpost-legacy-dismissed:42', '1');
    apiClientGet.mockResolvedValue({
      data: { legacyDetected: true, envValuePresent: true, perAccountConfigured: false },
    });

    renderWithProviders();
    // Give react a tick to settle.
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('sparkpost-legacy-migration-dialog')).not.toBeInTheDocument();
    expect(apiClientGet).not.toHaveBeenCalled();
  });
});
