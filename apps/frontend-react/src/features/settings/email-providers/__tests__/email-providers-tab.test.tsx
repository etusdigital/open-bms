// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import '@/lib/i18n';

const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock('../../use-settings', () => ({
  useAccountId: () => 42,
  useUpdateAccountConfigs: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useRefreshAccountConfigs: () => vi.fn(),
}));

const mockHook = vi.fn();
vi.mock('../use-email-providers', () => ({
  useEmailProviders: () => mockHook(),
}));

import { EmailProvidersTab } from '../email-providers-tab';

const SENDGRID_CONFIGURED = {
  name: 'sendgrid',
  label: 'SendGrid',
  configured: true,
  hasFreeTier: false,
  hasWebhook: true,
};

function setHook(state: Partial<ReturnType<any>>) {
  mockHook.mockReturnValue({
    providers: [],
    configuredProviders: [],
    hasAnyConfigured: false,
    defaultProvider: null,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
    ...state,
  });
}

function renderTab() {
  return render(<EmailProvidersTab />, { wrapper: createQueryWrapper() });
}

describe('EmailProvidersTab (EVO-1462 listing)', () => {
  beforeEach(() => {
    mockMutateAsync.mockClear();
    mockHook.mockReset();
  });

  it('shows skeleton rows while loading', () => {
    setHook({ isLoading: true });
    renderTab();
    expect(screen.getByTestId('providers-table-skeleton')).toBeInTheDocument();
  });

  it('shows empty state CTA when no providers configured', () => {
    setHook({ configuredProviders: [] });
    renderTab();
    expect(screen.getByTestId('providers-empty-state')).toBeInTheDocument();
  });

  it('shows retry alert when listing errors out without blocking the Add CTA', () => {
    setHook({ isError: true, configuredProviders: [] });
    renderTab();
    expect(screen.getByTestId('providers-list-error')).toBeInTheDocument();
    expect(screen.getByTestId('add-provider-cta')).not.toBeDisabled();
  });

  it('disables Add CTA when SendGrid is already configured (1-per-type)', () => {
    setHook({ configuredProviders: [SENDGRID_CONFIGURED], defaultProvider: 'sendgrid' });
    renderTab();
    expect(screen.getByTestId('add-provider-cta')).toBeDisabled();
  });

  it('renders configured row with Default badge', () => {
    setHook({ configuredProviders: [SENDGRID_CONFIGURED], defaultProvider: 'sendgrid' });
    renderTab();
    expect(screen.getByTestId('provider-row-sendgrid')).toBeInTheDocument();
    expect(screen.getByTestId('default-badge-sendgrid')).toBeInTheDocument();
  });

  it('opens the SendGrid form modal when SendGrid is selected from the type picker', () => {
    setHook({ configuredProviders: [] });
    renderTab();
    fireEvent.click(screen.getByTestId('add-provider-cta'));
    fireEvent.click(screen.getByTestId('provider-type-sendgrid'));
    expect(screen.getByTestId('sendgrid-form-modal')).toBeInTheDocument();
  });
});
