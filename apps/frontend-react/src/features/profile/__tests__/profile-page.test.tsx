// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { useAppStore } from '@/stores/app-store';
import '@/lib/i18n';
import ProfilePage from '../profile-page';

// Mock the API hooks to avoid actual network calls
vi.mock('../api', () => ({
  useUpdateProfile: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdatePassword: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadAvatar: () => ({ mutate: vi.fn(), isPending: false }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

async function renderProfilePage() {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>,
  );
}

function authenticateAs(providerId: string) {
  useAppStore.getState().setAuthenticated({
    user: {
      id: 1,
      name: 'Test User',
      email: 'test@test.com',
      profile: '',
      providerId,
      status: 'active',
    },
    account: {
      id: 1,
      name: 'Account',
      description: '',
      isActive: true,
      isInternal: false,
      groupId: 1,
    },
    userAccounts: [],
    permissions: [],
    effectiveRole: 'admin',
    globalRole: null,
    isMasterUser: false,
    accountConfigs: [],
    timezone: 'UTC',
  });
}

describe('ProfilePage', () => {
  beforeEach(() => {
    useAppStore.setState({
      auth: { status: 'idle' },
      sidebarCollapsed: false,
      savedAccountId: null,
    });
  });

  it('renders nothing when not authenticated', async () => {
    const { container } = await renderProfilePage();
    expect(container.innerHTML).toBe('');
  });

  describe('auth0 database user (auth0|...)', () => {
    beforeEach(() => {
      authenticateAs('auth0|abc123');
    });

    it('shows the password section', async () => {
      await renderProfilePage();
      expect(screen.getByText('Alterar senha')).toBeDefined();
    });

    it('email field is enabled', async () => {
      await renderProfilePage();
      const emailInput = screen.getByLabelText('Email');
      expect(emailInput).not.toBeDisabled();
    });

    it('shows info and password cards', async () => {
      await renderProfilePage();
      expect(screen.getByText('Informações pessoais')).toBeDefined();
      expect(screen.getByText('Alterar senha')).toBeDefined();
    });
  });

  describe('social login user (google-oauth2|...)', () => {
    beforeEach(() => {
      authenticateAs('google-oauth2|12345');
    });

    it('hides the password section', async () => {
      await renderProfilePage();
      expect(screen.queryByText('Alterar senha')).toBeNull();
    });

    it('email field is disabled', async () => {
      await renderProfilePage();
      const emailInput = screen.getByLabelText('Email');
      expect(emailInput).toBeDisabled();
    });

    it('still shows info card', async () => {
      await renderProfilePage();
      expect(screen.getByText('Informações pessoais')).toBeDefined();
    });

    it('name field remains editable', async () => {
      await renderProfilePage();
      const nameInput = screen.getByLabelText('Nome');
      expect(nameInput).not.toBeDisabled();
    });
  });

  describe('other providers', () => {
    it('hides password for windowslive provider', async () => {
      authenticateAs('windowslive|67890');
      await renderProfilePage();
      expect(screen.queryByText('Alterar senha')).toBeNull();
    });

    it('hides password for apple provider', async () => {
      authenticateAs('apple|67890');
      await renderProfilePage();
      expect(screen.queryByText('Alterar senha')).toBeNull();
    });
  });
});
