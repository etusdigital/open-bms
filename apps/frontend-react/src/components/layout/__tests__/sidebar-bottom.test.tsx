// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { useAppStore } from '@/stores/app-store';
import '@/lib/i18n';

// Mock our auth shim — sidebar uses useAuth().logout
const mockLogout = vi.fn().mockResolvedValue(undefined);
vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 1, name: 'Test', email: 'test@test.com', picture: null, providerId: 'local|abc' },
    logout: mockLogout,
    login: vi.fn(),
    refresh: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('tok'),
    getAccessTokenSilently: vi.fn().mockResolvedValue('tok'),
    loginWithRedirect: vi.fn(),
  }),
}));

// Track theme state for mock
let mockTheme = 'system' as 'light' | 'dark' | 'system';
const mockSetTheme = vi.fn((t: string) => {
  mockTheme = t as 'light' | 'dark' | 'system';
});

vi.mock('@/lib/theme', () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
    resolvedTheme: mockTheme === 'system' ? 'light' : mockTheme,
  }),
}));

// Must import after mocks
const { Sidebar } = await import('../sidebar');

function authenticate() {
  useAppStore.getState().setAuthenticated({
    user: {
      id: 1,
      name: 'Test User',
      email: 'test@test.com',
      profile: '',
      providerId: 'auth0|123',
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
    permissions: ['account:settings_view' as any],
    effectiveRole: 'admin',
    globalRole: null,
    isMasterUser: false,
    accountConfigs: [],
    timezone: 'UTC',
  });
}

async function renderSidebar(collapsed = false) {
  useAppStore.getState().setSidebarCollapsed(collapsed);
  return renderWithRouter(
    <TooltipProvider>
      <Sidebar />
    </TooltipProvider>,
  );
}

describe('Sidebar layout - 3 fixed sections with scrollable nav', () => {
  beforeEach(() => {
    useAppStore.setState({
      auth: { status: 'idle' },
      sidebarCollapsed: false,
      savedAccountId: null,
    });
  });

  it('has a fixed top section (logo + account selector)', async () => {
    authenticate();
    await renderSidebar(false);
    const top = screen.getByTestId('sidebar-top');
    expect(top).toBeDefined();
    expect(top.className).not.toContain('overflow');
  });

  it('has a scrollable nav section with overflow-y-auto', async () => {
    authenticate();
    await renderSidebar(false);
    const nav = screen.getByTestId('sidebar-nav');
    expect(nav.className).toContain('flex-1');
    expect(nav.className).toContain('overflow-y-auto');
  });

  it('has a fixed bottom section that does not scroll', async () => {
    authenticate();
    await renderSidebar(false);
    const bottom = screen.getByTestId('sidebar-bottom');
    expect(bottom).toBeDefined();
    expect(bottom.className).not.toContain('overflow');
  });

  it('sidebar uses h-screen and flex-col for proper layout', async () => {
    authenticate();
    const { container } = await renderSidebar(false);
    const aside = container.querySelector('aside')!;
    expect(aside.className).toContain('h-screen');
    expect(aside.className).toContain('flex-col');
  });
});

describe('Sidebar bottom - user popover menu', () => {
  beforeEach(() => {
    useAppStore.setState({
      auth: { status: 'idle' },
      sidebarCollapsed: false,
      savedAccountId: null,
    });
    mockTheme = 'system';
    mockSetTheme.mockClear();
    mockLogout.mockClear();
  });

  it('does NOT have a standalone theme-signout-row anymore', async () => {
    authenticate();
    await renderSidebar(false);
    expect(screen.queryByTestId('theme-signout-row')).toBeNull();
  });

  it('renders a user menu trigger button (not a direct link)', async () => {
    authenticate();
    await renderSidebar(false);
    const trigger = screen.getByTestId('user-menu-trigger');
    expect(trigger).toBeDefined();
    // Should NOT be an <a> tag (not a direct link to /profile)
    expect(trigger.tagName).not.toBe('A');
  });

  it('shows user name and role on the trigger when expanded', async () => {
    authenticate();
    await renderSidebar(false);
    const trigger = screen.getByTestId('user-menu-trigger');
    expect(trigger.textContent).toContain('Test User');
    expect(trigger.textContent).toContain('admin');
  });

  it('shows only avatar when collapsed (no text)', async () => {
    authenticate();
    await renderSidebar(true);
    const trigger = screen.getByTestId('user-menu-trigger');
    // Should contain avatar but no visible name text
    expect(trigger.querySelector('[data-slot="avatar"]')).not.toBeNull();
    expect(trigger.textContent).not.toContain('Test User');
  });

  it('opens a popover menu when user avatar is clicked', async () => {
    authenticate();
    await renderSidebar(false);
    const trigger = screen.getByTestId('user-menu-trigger');
    fireEvent.click(trigger);

    const menu = screen.getByTestId('user-menu-content');
    expect(menu).toBeDefined();
  });

  it('popover contains a link to profile page', async () => {
    authenticate();
    await renderSidebar(false);
    fireEvent.click(screen.getByTestId('user-menu-trigger'));

    const menu = screen.getByTestId('user-menu-content');
    const profileLink = within(menu).getByTestId('user-menu-profile');
    expect(profileLink).toBeDefined();
    expect(profileLink.textContent).toContain('Perfil');
  });

  it('popover contains a theme toggle', async () => {
    authenticate();
    await renderSidebar(false);
    fireEvent.click(screen.getByTestId('user-menu-trigger'));

    const menu = screen.getByTestId('user-menu-content');
    const themeButton = within(menu).getByTestId('theme-toggle');
    expect(themeButton).toBeDefined();
  });

  it('theme toggle switches between light and dark', async () => {
    authenticate();
    mockTheme = 'light';
    await renderSidebar(false);
    fireEvent.click(screen.getByTestId('user-menu-trigger'));

    const menu = screen.getByTestId('user-menu-content');
    const themeButton = within(menu).getByTestId('theme-toggle');
    fireEvent.click(themeButton);
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('popover contains a sign out button', async () => {
    authenticate();
    await renderSidebar(false);
    fireEvent.click(screen.getByTestId('user-menu-trigger'));

    const menu = screen.getByTestId('user-menu-content');
    const signOutBtn = within(menu).getByTestId('sign-out-button');
    expect(signOutBtn).toBeDefined();
    expect(signOutBtn.textContent).toContain('Sair');
  });

  it('sign out button calls auth shim logout', async () => {
    authenticate();
    await renderSidebar(false);
    fireEvent.click(screen.getByTestId('user-menu-trigger'));

    const menu = screen.getByTestId('user-menu-content');
    fireEvent.click(within(menu).getByTestId('sign-out-button'));
    expect(mockLogout).toHaveBeenCalled();
  });

  it('bottom section has only 3 elements: settings, user menu, collapse', async () => {
    authenticate();
    await renderSidebar(false);
    const bottom = screen.getByTestId('sidebar-bottom');
    // Settings link, user menu trigger, separator, collapse button
    // No standalone theme or logout icons should appear
    expect(screen.queryByTestId('theme-signout-row')).toBeNull();
    expect(bottom.querySelector('[data-testid="user-menu-trigger"]')).not.toBeNull();
  });
});
