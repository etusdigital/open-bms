// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

// cmdk calls scrollIntoView which jsdom doesn't implement
Element.prototype.scrollIntoView = vi.fn();
import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { useAppStore } from '@/stores/app-store';
import '@/lib/i18n';

// Mock our auth shim — account-selector doesn't use it directly, but other
// components imported transitively (sidebar) might.
vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 1, name: 'Test', email: 'test@test.com', picture: null, providerId: 'local|abc' },
    logout: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
    refresh: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('tok'),
    getAccessTokenSilently: vi.fn().mockResolvedValue('tok'),
    loginWithRedirect: vi.fn(),
  }),
}));

// Mock use-account-switch
const mockSwitchAccount = vi.fn();
vi.mock('@/hooks/use-account-switch', () => ({
  useAccountSwitch: () => ({ switchAccount: mockSwitchAccount }),
}));

const { AccountSelector } = await import('../account-selector');

function authenticate(accountName = 'Plusdin', accounts?: { id: number; name: string }[]) {
  const mainAccount = {
    id: 1,
    name: accountName,
    description: '',
    isActive: true,
    isInternal: false,
    groupId: 1,
  };
  const userAccounts = accounts
    ? accounts.map((a) => ({
        accountId: a.id,
        isMasterUser: false,
        account: { ...a, description: '', isActive: true, isInternal: false, groupId: 1 },
      }))
    : [{ accountId: 1, isMasterUser: false, account: mainAccount }];

  useAppStore.getState().setAuthenticated({
    user: {
      id: 1,
      name: 'Test User',
      email: 'test@test.com',
      profile: '',
      providerId: 'auth0|123',
      status: 'active',
    },
    account: mainAccount,
    userAccounts: userAccounts as any,
    permissions: [],
    effectiveRole: 'admin',
    globalRole: null,
    isMasterUser: false,
    accountConfigs: [],
    timezone: 'UTC',
  });
}

async function renderSelector(collapsed = false) {
  return renderWithRouter(
    <TooltipProvider>
      <AccountSelector collapsed={collapsed} />
    </TooltipProvider>,
  );
}

describe('AccountSelector', () => {
  beforeEach(() => {
    useAppStore.getState().resetAuth();
    mockSwitchAccount.mockClear();
  });

  it('shows account name when expanded', async () => {
    authenticate('Plusdin');
    await renderSelector(false);
    expect(screen.getByText('Plusdin')).toBeDefined();
  });

  it('shows chevron icon when expanded', async () => {
    authenticate();
    await renderSelector(false);
    const button = screen.getByRole('combobox');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  describe('collapsed mode - initial badge', () => {
    it('shows first letter of account name as uppercase', async () => {
      authenticate('Plusdin');
      await renderSelector(true);
      const badge = screen.getByRole('combobox');
      expect(badge.textContent).toBe('P');
    });

    it('shows correct initial for different account names', async () => {
      authenticate('Acme Corp');
      await renderSelector(true);
      const badge = screen.getByRole('combobox');
      expect(badge.textContent).toBe('A');
    });

    it('renders as a circular badge (rounded-full)', async () => {
      authenticate('Plusdin');
      await renderSelector(true);
      const badge = screen.getByRole('combobox');
      expect(badge.className).toContain('rounded-full');
    });

    it('has consistent 9x9 sizing (h-9 w-9)', async () => {
      authenticate('Plusdin');
      await renderSelector(true);
      const badge = screen.getByRole('combobox');
      expect(badge.className).toContain('h-9');
      expect(badge.className).toContain('w-9');
    });

    it('does NOT show chevron icon in collapsed mode', async () => {
      authenticate('Plusdin');
      await renderSelector(true);
      const badge = screen.getByRole('combobox');
      expect(badge.querySelector('svg')).toBeNull();
    });

    it('does NOT show the account name text', async () => {
      authenticate('Plusdin');
      await renderSelector(true);
      expect(screen.queryByText('Plusdin')).toBeNull();
    });
  });

  describe('name trimming', () => {
    it('trims leading/trailing whitespace from account name in trigger', async () => {
      authenticate(' Consulta Finanças ');
      await renderSelector(false);
      expect(screen.getByText('Consulta Finanças')).toBeDefined();
      expect(screen.queryByText(' Consulta Finanças ')).toBeNull();
    });

    it('trims whitespace for collapsed initial', async () => {
      authenticate(' Consulta Finanças ');
      await renderSelector(true);
      const badge = screen.getByRole('combobox');
      expect(badge.textContent).toBe('C');
    });

    it('trims whitespace in dropdown list items', async () => {
      authenticate('Plusdin', [
        { id: 1, name: 'Plusdin' },
        { id: 2, name: ' Consulta Finanças ' },
      ]);
      await renderSelector(false);
      fireEvent.click(screen.getByRole('combobox'));

      const items = [...document.querySelectorAll('[data-slot="command-item"]')];
      const names = items.map((el) => el.querySelector('span.truncate')?.textContent);
      expect(names).toContain('Consulta Finanças');
      expect(names).not.toContain(' Consulta Finanças ');
    });
  });

  describe('alphabetical sorting', () => {
    it('sorts accounts alphabetically case-insensitive', async () => {
      authenticate('Plusdin', [
        { id: 1, name: 'Plusdin' },
        { id: 2, name: 'agoraeducacao' },
        { id: 3, name: ' Consulta Finanças' },
        { id: 4, name: 'Athivor' },
      ]);
      await renderSelector(false);
      fireEvent.click(screen.getByRole('combobox'));

      const items = [...document.querySelectorAll('[data-slot="command-item"]')];
      const names = items.map((el) => el.querySelector('span.truncate')?.textContent);
      expect(names).toEqual(['agoraeducacao', 'Athivor', 'Consulta Finanças', 'Plusdin']);
    });

    it('sorts trimmed names so leading spaces do not affect order', async () => {
      authenticate('b-second', [
        { id: 1, name: 'b-second' },
        { id: 2, name: ' a-first' },
      ]);
      await renderSelector(false);
      fireEvent.click(screen.getByRole('combobox'));

      const items = [...document.querySelectorAll('[data-slot="command-item"]')];
      const names = items.map((el) => el.querySelector('span.truncate')?.textContent);
      expect(names).toEqual(['a-first', 'b-second']);
    });
  });
});
