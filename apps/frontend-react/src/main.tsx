import './lib/instrument';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/router';
import '@/lib/i18n';
import './index.css';

// Defer Clarity loading — analytics doesn't need to block hydration
import('@/lib/clarity').then(({ initClarity }) => initClarity());

function InnerApp() {
  const auth = useAuth0();
  return <RouterProvider router={router} context={{ auth }} />;
}

function App() {
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin + '/callback',
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      }}
      cacheLocation="memory"
      useRefreshTokens={true}
      useRefreshTokensFallback={true}
      onRedirectCallback={(appState) => {
        // Store returnTo so the callback page can navigate after Auth0 state updates.
        // onRedirectCallback fires BEFORE Auth0 updates isAuthenticated in React state,
        // so navigating here would hit beforeLoad with stale context.
        const returnTo = appState?.returnTo;
        const safePath = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
        sessionStorage.setItem('auth_return_to', safePath);
      }}
    >
      <InnerApp />
    </Auth0Provider>
  );
}

createRoot(document.getElementById('root')!, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
