import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useAuthInit } from '@/hooks/use-auth-init';
import { LoadingScreen } from '@/components/loading-screen';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    // While Auth0 SDK is initializing, don't redirect — let component show loading
    if (context.auth.isLoading) return;

    // Auth0 done loading, user not authenticated → redirect to login
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { returnTo: location.href },
      });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const authStatus = useAppStore((s) => s.auth.status);
  const { isLoading, isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const redirectedRef = useRef(false);

  // beforeLoad only runs once per navigation — if Auth0 was still loading initially
  // and now finished with isAuthenticated=false, redirect to login from the component.
  // Use window.location.pathname (stable) instead of useRouterState (reactive),
  // and a ref guard to prevent duplicate redirects.
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !redirectedRef.current) {
      redirectedRef.current = true;
      navigate({
        to: '/login',
        search: { returnTo: window.location.pathname + window.location.search },
        replace: true,
      });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Trigger backend sync (POST /users/login, GET /users/me, etc.)
  useAuthInit();

  // Show loading while Auth0 SDK initializes or during backend auth sync
  if (isLoading || authStatus === 'authenticating' || authStatus === 'switching' || authStatus === 'idle') {
    return <LoadingScreen />;
  }

  return <Outlet />;
}
