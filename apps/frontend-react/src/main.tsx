import './lib/instrument';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import * as Sentry from '@sentry/react';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/router';
import { useAppStore } from '@/stores/app-store';
import { bootstrapAuth, useAuth } from '@/features/auth/use-auth';
import { setupGateway } from '@/features/setup/setup-gateway';
import '@/lib/i18n';
import './index.css';

import('@/lib/clarity').then(({ initClarity }) => initClarity());

const AUTH_PROVIDER = (import.meta.env.VITE_AUTH_PROVIDER ?? 'local') as 'local' | 'auth0';

/**
 * Setup gate: before mounting the router, ask the backend if the platform is
 * configured. If not, force navigation to /setup (any path → /setup). If yes
 * and the user happens to be sitting on /setup, send them home.
 *
 * Failure handling mirrors the Vue 3 manager router guard: 404 or no response
 * (fresh VM, backend unreachable) → redirect to /setup. On 5xx the platform
 * is already configured but the API is transiently unhealthy — better to
 * surface the error downstream than flash the wizard on a hiccup.
 */
async function applySetupGate(): Promise<void> {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  try {
    const status = await setupGateway.getStatus();
    if (!status.configured && path !== '/setup') {
      window.history.replaceState(null, '', '/setup');
    } else if (status.configured && path === '/setup') {
      window.history.replaceState(null, '', '/');
    }
  } catch (err) {
    const httpStatus = axios.isAxiosError(err) ? err.response?.status : undefined;
    if ((!httpStatus || httpStatus === 404) && path !== '/setup') {
      window.history.replaceState(null, '', '/setup');
    }
  }
}

function LocalApp() {
  const { isAuthenticated, isLoading } = useAuth();
  return <RouterProvider router={router} context={{ auth: { isAuthenticated, isLoading } }} />;
}

async function mountLocal(): Promise<void> {
  await applySetupGate();
  await bootstrapAuth().catch(() => false);
  // After bootstrap, if a refresh succeeded the access token is in memory but
  // the Zustand auth state is still 'idle'. Hydration of /users/me happens
  // inside the authenticated layout via useAuthInit().
  createRoot(document.getElementById('root')!, {
    onUncaughtError: Sentry.reactErrorHandler(),
    onCaughtError: Sentry.reactErrorHandler(),
  }).render(
    <StrictMode>
      <LocalApp />
    </StrictMode>,
  );
}

async function mountAuth0(): Promise<void> {
  await applySetupGate();
  const [{ Auth0Provider }, { Auth0RouterBridge }] = await Promise.all([
    import('@auth0/auth0-react'),
    import('@/features/auth/auth0-adapter'),
  ]);

  function Auth0App() {
    return (
      <Auth0Provider
        domain={import.meta.env.VITE_AUTH0_DOMAIN as string}
        clientId={import.meta.env.VITE_AUTH0_CLIENT_ID as string}
        authorizationParams={{
          redirect_uri: window.location.origin + '/callback',
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        }}
        cacheLocation="memory"
        useRefreshTokens={true}
        useRefreshTokensFallback={true}
        onRedirectCallback={(appState) => {
          const returnTo = appState?.returnTo;
          const ok = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//');
          sessionStorage.setItem('auth_return_to', ok ? returnTo : '/');
        }}
      >
        <Auth0RouterBridge router={router} />
      </Auth0Provider>
    );
  }

  createRoot(document.getElementById('root')!, {
    onUncaughtError: Sentry.reactErrorHandler(),
    onCaughtError: Sentry.reactErrorHandler(),
  }).render(
    <StrictMode>
      <Auth0App />
    </StrictMode>,
  );
}

// useAppStore is referenced for tree-shake stability (it's the auth state of
// truth and is read by router context downstream). The compiler must not
// drop the symbol before the routes pull it in.
void useAppStore;

if (AUTH_PROVIDER === 'auth0') {
  void mountAuth0();
} else {
  void mountLocal();
}
