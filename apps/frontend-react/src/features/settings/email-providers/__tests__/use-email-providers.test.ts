// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';

vi.mock('../sendgrid-account-gateway', () => ({
  accountSendgridGateway: { get: vi.fn() },
}));
vi.mock('../mailersend-account-gateway', () => ({
  accountMailersendGateway: { get: vi.fn() },
}));
vi.mock('../sparkpost-account-gateway', () => ({
  accountSparkpostGateway: { get: vi.fn() },
}));
vi.mock('../resend-account-gateway', () => ({
  accountResendGateway: { get: vi.fn() },
}));
vi.mock('../amazon-ses-account-gateway', () => ({
  accountSesGateway: { get: vi.fn() },
}));
vi.mock('../mandrill-account-gateway', () => ({
  accountMandrillGateway: { get: vi.fn() },
}));

vi.mock('../../use-settings', () => ({
  useAccountId: () => 42,
  useAccountConfig: (name: string) => (name === 'default_email_provider' ? 'mailersend' : ''),
}));

import { useEmailProviders } from '../use-email-providers';
import { accountSendgridGateway } from '../sendgrid-account-gateway';
import { accountMailersendGateway } from '../mailersend-account-gateway';
import { accountSparkpostGateway } from '../sparkpost-account-gateway';
import { accountResendGateway } from '../resend-account-gateway';
import { accountSesGateway } from '../amazon-ses-account-gateway';
import { accountMandrillGateway } from '../mandrill-account-gateway';

describe('useEmailProviders', () => {
  beforeEach(() => {
    (accountSendgridGateway.get as ReturnType<typeof vi.fn>).mockReset();
    (accountMailersendGateway.get as ReturnType<typeof vi.fn>).mockReset();
    (accountSparkpostGateway.get as ReturnType<typeof vi.fn>).mockReset();
    (accountResendGateway.get as ReturnType<typeof vi.fn>).mockReset();
    (accountSesGateway.get as ReturnType<typeof vi.fn>).mockReset();
    (accountMandrillGateway.get as ReturnType<typeof vi.fn>).mockReset();
  });

  it('returns providers array with 6 entries (incl. SendGrid) and exposes defaultProvider', async () => {
    (accountSendgridGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'none' });
    (accountMailersendGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'account' });
    (accountSparkpostGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'none' });
    (accountResendGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'none' });
    (accountSesGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'none' });
    (accountMandrillGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'none' });

    const { result } = renderHook(() => useEmailProviders(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.providers.length).toBe(6));
    expect(result.current.defaultProvider).toBe('mailersend');
    expect(result.current.providers.some((p) => p.name === 'sendgrid')).toBe(true);
  });

  it('marks configured=true only for providers where get returns source: account', async () => {
    (accountSendgridGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'account' });
    (accountMailersendGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'account' });
    (accountSparkpostGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'account' });
    (accountResendGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'none' });
    (accountSesGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'none' });
    (accountMandrillGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'none' });

    const { result } = renderHook(() => useEmailProviders(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const byName = Object.fromEntries(result.current.providers.map((p) => [p.name, p.configured]));
    expect(byName.sendgrid).toBe(true);
    expect(byName.mailersend).toBe(true);
    expect(byName.sparkpost).toBe(true);
    expect(byName.resend).toBe(false);
    expect(byName.ses).toBe(false);
    expect(byName.mandrill).toBe(false);
  });

  it('refresh() triggers re-fetch of all gateways', async () => {
    (accountSendgridGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'none' });
    (accountMailersendGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'none' });
    (accountSparkpostGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'none' });
    (accountResendGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'none' });
    (accountSesGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'none' });
    (accountMandrillGateway.get as ReturnType<typeof vi.fn>).mockResolvedValue({ source: 'none' });

    const { result } = renderHook(() => useEmailProviders(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const before = (accountMailersendGateway.get as ReturnType<typeof vi.fn>).mock.calls.length;
    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() =>
      expect((accountMailersendGateway.get as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(before),
    );
  });
});
