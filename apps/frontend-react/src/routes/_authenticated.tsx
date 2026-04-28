import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useAuthInit } from '@/hooks/use-auth-init';
import { LoadingScreen } from '@/components/loading-screen';
import { useAuth } from '@/features/auth/use-auth';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (context.auth.isLoading) return;

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
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const redirectedRef = useRef(false);

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

  useAuthInit();

  if (isLoading || authStatus === 'authenticating' || authStatus === 'switching' || authStatus === 'idle') {
    return <LoadingScreen />;
  }

  return <Outlet />;
}
