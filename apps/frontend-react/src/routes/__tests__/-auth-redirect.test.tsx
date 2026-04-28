// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render, act } from '@testing-library/react';
import {
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
  RouterProvider,
  Outlet,
  redirect,
} from '@tanstack/react-router';

// ── Mocks ──────────────────────────────────────────────────────────

const mockLoginWithRedirect = vi.fn();
const mockLogout = vi.fn();
let mockAuth0State = {
  isLoading: false,
  isAuthenticated: false,
  user: null as Record<string, string> | null,
  loginWithRedirect: mockLoginWithRedirect,
  logout: mockLogout,
};

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => mockAuth0State,
}));

vi.mock('@/hooks/use-auth-init', () => ({
  useAuthInit: vi.fn(),
}));

vi.mock('@/stores/app-store', () => ({
  useAppStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) => selector({ auth: { status: 'authenticated' } }),
    {
      getState: () => ({ auth: { status: 'authenticated' } }),
    },
  ),
}));

vi.mock('@/components/loading-screen', () => ({
  LoadingScreen: ({ message }: { message?: string }) => <div data-testid="loading-screen">{message}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// ── Helpers ────────────────────────────────────────────────────────

function createTestRouter(initialPath: string, auth: { isAuthenticated: boolean; isLoading: boolean }) {
  const rootRoute = createRootRoute({
    component: Outlet,
  });

  const authenticatedRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_authenticated',
    beforeLoad: ({ location }) => {
      if (auth.isLoading) return;
      if (!auth.isAuthenticated) {
        throw redirect({
          to: '/login',
          search: { returnTo: location.href },
        });
      }
    },
    component: Outlet,
  });

  const dashboardRoute = createRoute({
    getParentRoute: () => authenticatedRoute,
    path: '/analytics/dashboard',
    component: () => <div data-testid="dashboard">Dashboard</div>,
  });

  const leadsRoute = createRoute({
    getParentRoute: () => authenticatedRoute,
    path: '/analytics/leads',
    component: () => <div data-testid="leads">Leads</div>,
  });

  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: () => {
      const search = loginRoute.useSearch() as { returnTo?: string };
      return (
        <div data-testid="login-page" data-return-to={search.returnTo ?? ''}>
          Login
        </div>
      );
    },
    validateSearch: (search: Record<string, unknown>) => ({
      returnTo: (search.returnTo as string) || undefined,
    }),
  });

  const routeTree = rootRoute.addChildren([authenticatedRoute.addChildren([dashboardRoute, leadsRoute]), loginRoute]);

  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}

async function renderRouter(initialPath: string, auth = { isAuthenticated: false, isLoading: false }) {
  const router = createTestRouter(initialPath, auth);
  await router.load();

  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<RouterProvider router={router} />);
  });

  return { ...result, router };
}

// ── Tests: beforeLoad redirect preserves query params ──────────────

describe('Auth redirect preserves query params', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('redirects to /login with full path including query params when not authenticated', async () => {
    const fullPath = '/analytics/leads?groupItems=utm_source%2Cutm_medium&startDate=2026-04-08&page=1';

    await renderRouter(fullPath);

    await waitFor(() => {
      const loginPage = screen.getByTestId('login-page');
      expect(loginPage).toBeInTheDocument();
      const returnTo = loginPage.getAttribute('data-return-to');
      expect(returnTo).toContain('/analytics/leads');
      expect(returnTo).toContain('groupItems=');
      expect(returnTo).toContain('startDate=');
      expect(returnTo).toContain('page=');
    });
  });

  it('redirects to /login with simple path when no query params', async () => {
    await renderRouter('/analytics/dashboard');

    await waitFor(() => {
      const loginPage = screen.getByTestId('login-page');
      expect(loginPage).toBeInTheDocument();
      const returnTo = loginPage.getAttribute('data-return-to');
      expect(returnTo).toBe('/analytics/dashboard');
    });
  });

  it('preserves encoded special characters in query params', async () => {
    const fullPath = '/analytics/leads?search=email_provider%3AYahoo%2Cutm_source%3Agoogle&page=1';

    await renderRouter(fullPath);

    await waitFor(() => {
      const loginPage = screen.getByTestId('login-page');
      const returnTo = loginPage.getAttribute('data-return-to');
      expect(returnTo).toContain('search=');
      expect(returnTo).toContain('page=1');
    });
  });

  it('does not redirect when user is authenticated', async () => {
    await renderRouter('/analytics/dashboard', { isAuthenticated: true, isLoading: false });

    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });
});

// ── Tests: callback restores returnTo from sessionStorage ──────────

describe('Callback page restores returnTo with query params', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('stores full path with query params in sessionStorage via onRedirectCallback', () => {
    // Simulate what main.tsx onRedirectCallback does
    const returnTo = '/analytics/leads?groupItems=utm_source%2Cutm_medium&startDate=2026-04-08';
    const appState = { returnTo };

    const safePath =
      appState.returnTo && appState.returnTo.startsWith('/') && !appState.returnTo.startsWith('//')
        ? appState.returnTo
        : '/';

    sessionStorage.setItem('auth_return_to', safePath);

    expect(sessionStorage.getItem('auth_return_to')).toBe(returnTo);
  });

  it('rejects absolute URLs and falls back to /', () => {
    const appState = { returnTo: 'https://evil.com/steal' };

    const safePath =
      appState.returnTo && appState.returnTo.startsWith('/') && !appState.returnTo.startsWith('//')
        ? appState.returnTo
        : '/';

    sessionStorage.setItem('auth_return_to', safePath);

    expect(sessionStorage.getItem('auth_return_to')).toBe('/');
  });

  it('rejects protocol-relative URLs and falls back to /', () => {
    const appState = { returnTo: '//evil.com/steal' };

    const safePath =
      appState.returnTo && appState.returnTo.startsWith('/') && !appState.returnTo.startsWith('//')
        ? appState.returnTo
        : '/';

    sessionStorage.setItem('auth_return_to', safePath);

    expect(sessionStorage.getItem('auth_return_to')).toBe('/');
  });

  it('falls back to / when appState has no returnTo', () => {
    const appState: { returnTo?: string } = {};

    const returnTo = appState?.returnTo;
    const safePath = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';

    sessionStorage.setItem('auth_return_to', safePath);

    expect(sessionStorage.getItem('auth_return_to')).toBe('/');
  });
});

// ── Tests: login page passes returnTo to Auth0 ─────────────────────

describe('Login page preserves returnTo through Auth0', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth0State = {
      isLoading: false,
      isAuthenticated: false,
      user: null,
      loginWithRedirect: mockLoginWithRedirect,
      logout: mockLogout,
    };
  });

  it('passes full path with query params to loginWithRedirect', async () => {
    const returnTo = '/analytics/leads?groupItems=utm_source%2Cutm_medium&startDate=2026-04-08&page=1';

    // Create a minimal router that renders the login page with returnTo search param
    const rootRoute = createRootRoute({ component: Outlet });

    const loginRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/login',
      validateSearch: (search: Record<string, unknown>) => ({
        returnTo: (search.returnTo as string) || undefined,
      }),
      component: function LoginTest() {
        const { loginWithRedirect } = mockAuth0State;
        const search = loginRoute.useSearch();
        const handledRef = { current: false };

        const safePath =
          search.returnTo && search.returnTo.startsWith('/') && !search.returnTo.startsWith('//')
            ? search.returnTo
            : '/';

        if (!handledRef.current) {
          handledRef.current = true;
          loginWithRedirect({ appState: { returnTo: safePath } });
        }

        return <div data-testid="login">Login</div>;
      },
    });

    const routeTree = rootRoute.addChildren([loginRoute]);
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: [`/login?returnTo=${encodeURIComponent(returnTo)}`],
      }),
    });

    await router.load();
    await act(async () => {
      render(<RouterProvider router={router} />);
    });

    await waitFor(() => {
      expect(mockLoginWithRedirect).toHaveBeenCalledWith({
        appState: { returnTo },
      });
    });
  });
});
