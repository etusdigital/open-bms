import { useEffect, useRef } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LoadingScreen } from '@/components/loading-screen';
import { useAuth } from '@/features/auth/use-auth';

const AUTH_PROVIDER = (import.meta.env.VITE_AUTH_PROVIDER ?? 'local') as 'local' | 'auth0';

export const Route = createFileRoute('/callback')({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (AUTH_PROVIDER !== 'auth0' && !navigatedRef.current) {
      navigatedRef.current = true;
      navigate({ to: '/', replace: true });
    }
  }, [navigate]);

  if (AUTH_PROVIDER !== 'auth0') {
    return <LoadingScreen />;
  }

  return <Auth0Callback />;
}

function Auth0Callback() {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !navigatedRef.current) {
      navigatedRef.current = true;
      const returnTo = sessionStorage.getItem('auth_return_to') || '/';
      sessionStorage.removeItem('auth_return_to');
      navigate({ to: returnTo, replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Surface Auth0 errors via the error boundary instead of useAuth0().error,
  // since our useAuth() abstraction doesn't expose that field.
  return <LoadingScreen message={t('auth.connecting')} />;
}
