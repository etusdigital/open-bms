import { useEffect } from 'react';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/lib/theme';
import { queryClient } from '@/lib/query-client';
import { LoadingScreen } from '@/components/loading-screen';
import { setTokenFetcher } from '@/lib/api-client';
import type { RouterContext } from '@/lib/router-context';

export const Route = createRootRouteWithContext<RouterContext>()({
  pendingComponent: LoadingScreen,
  errorComponent: RootErrorComponent,
  component: RootComponent,
});

function AuthBridge() {
  const { getAccessTokenSilently } = useAuth0();
  useEffect(() => {
    setTokenFetcher(getAccessTokenSilently);
  }, [getAccessTokenSilently]);
  return null;
}

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthBridge />
          <Outlet />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootErrorComponent({ error }: { error: unknown }) {
  // Sentry already captures this via createRoot's onCaughtError handler —
  // calling captureException here would double-report.
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return (
    <div className="bg-background flex h-screen flex-col items-center justify-center gap-4">
      <img src="/logo.png" alt="BMS" className="h-12 w-12 object-contain" />
      <p className="text-destructive text-sm">{message}</p>
      <button
        onClick={() => window.location.replace('/')}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm"
      >
        Go Home
      </button>
    </div>
  );
}
