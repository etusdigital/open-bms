import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import IntegrationsPage from '../integrations-page';

vi.mock('../sendgrid-platform-gateway', () => ({
  sendgridPlatformGateway: { get: vi.fn().mockResolvedValue(null), save: vi.fn(), testConnection: vi.fn() },
}));
vi.mock('../s3-gateway', () => ({
  s3Gateway: { get: vi.fn().mockResolvedValue(null), save: vi.fn(), testConnection: vi.fn() },
}));
vi.mock('../fcm-gateway', () => ({
  fcmGateway: { get: vi.fn().mockResolvedValue(null), save: vi.fn(), testConnection: vi.fn() },
}));
vi.mock('../geoip-gateway', () => ({
  geoIpSettingsGateway: { get: vi.fn().mockResolvedValue(null), save: vi.fn() },
}));

describe('IntegrationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore({ role: 'super_admin' });
  });

  it('renders the page title', async () => {
    await renderWithRouter(<IntegrationsPage />);
    expect(screen.getByText('Integrações')).toBeInTheDocument();
  });

  it('shows all tabs', async () => {
    await renderWithRouter(<IntegrationsPage />);
    const tabs = [
      screen.getByRole('button', { name: 'SendGrid (plataforma)' }),
      screen.getByRole('button', { name: 'S3' }),
      screen.getByRole('button', { name: 'Firebase Cloud Messaging' }),
      screen.getByRole('button', { name: 'GeoIP' }),
    ];
    tabs.forEach((tab) => expect(tab).toBeInTheDocument());
    expect(tabs).toHaveLength(4);
  });

  it('starts with SendGrid platform tab active', async () => {
    await renderWithRouter(<IntegrationsPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/API Key/)).toBeInTheDocument();
    });
  });

  it('switches to S3 tab on click', async () => {
    await renderWithRouter(<IntegrationsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'S3' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Bucket')).toBeInTheDocument();
    });
  });
});
