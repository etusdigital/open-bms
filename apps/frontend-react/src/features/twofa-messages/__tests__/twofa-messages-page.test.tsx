import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import TwoFAMessagesPage from '../twofa-messages-page';
import type { TwoFASettings } from '../types';

const mockSettings: TwoFASettings = {
  email: {
    'login-group': [
      { message: { id: 1, title: 'OTP v1' }, percentage: 60 },
      { message: { id: 2, title: 'OTP v2' }, percentage: 40 },
    ],
    'password-reset': [{ message: { id: 3, title: 'Reset Email' }, percentage: 100 }],
  },
  sms: {},
  whatsapp: {},
};

let mockSettingsReturn: TwoFASettings | null = null;
const mockUpdateMutate = vi.fn();
let mockStatsReturn: Record<string, unknown> = {};

vi.mock('../use-twofa-messages', () => ({
  useTwoFASettings: () => mockSettingsReturn,
  useUpdateTwoFASettings: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useTwoFAStatistics: () => mockStatsReturn,
}));

function renderPage() {
  return renderWithRouter(<TwoFAMessagesPage />);
}

describe('TwoFAMessagesPage (groups)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore({
      permissions: ['messages:view', 'messages:create', 'messages:delete'],
      accountConfigs: [
        {
          accountId: 10,
          name: 'email_settings',
          value: JSON.stringify({ isActive: true }),
          isLoadConfig: false,
        },
        {
          accountId: 10,
          name: 'sms_settings',
          value: JSON.stringify({ isActive: true }),
          isLoadConfig: false,
        },
        {
          accountId: 10,
          name: 'whatsapp_settings',
          value: JSON.stringify({ isActive: true }),
          isLoadConfig: false,
        },
      ],
    });
    mockSettingsReturn = null;
    mockStatsReturn = {
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it('renders the page title', async () => {
    await renderPage();
    expect(screen.getByText('2FA')).toBeInTheDocument();
  });

  it('renders channel selector buttons', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SMS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WhatsApp' })).toBeInTheDocument();
  });

  it('shows create group button', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /criar grupo/i })).toBeInTheDocument();
  });

  it('shows empty state when no settings', async () => {
    mockSettingsReturn = null;
    await renderPage();
    expect(screen.getByText(/nenhum/i)).toBeInTheDocument();
  });

  it('shows group names when settings exist', async () => {
    mockSettingsReturn = mockSettings;
    await renderPage();
    expect(screen.getByText('login-group')).toBeInTheDocument();
    expect(screen.getByText('password-reset')).toBeInTheDocument();
  });

  it('shows empty state for channel with no groups', async () => {
    mockSettingsReturn = mockSettings;
    await renderPage();

    // Switch to SMS channel
    await act(async () => {
      screen.getByRole('button', { name: 'SMS' }).click();
    });

    // DataTableEmptyState renders "Nenhum grupos encontrado" or similar
    expect(screen.getByText(/nenhum|no .* found/i)).toBeInTheDocument();
  });
});
