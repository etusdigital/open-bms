import { useEffect, useRef } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuth0 } from '@auth0/auth0-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { LoadingScreen } from '@/components/loading-screen';

const loginSearchSchema = z.object({
  returnTo: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const { t } = useTranslation();
  const { returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const handledRef = useRef(false);

  const safePath = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';

  // If already authenticated, redirect away — don't stay on login
  useEffect(() => {
    if (!isLoading && isAuthenticated && !handledRef.current) {
      handledRef.current = true;
      navigate({ to: safePath, replace: true });
    }
  }, [isLoading, isAuthenticated, navigate, safePath]);

  // Not authenticated → trigger Auth0 login
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !handledRef.current) {
      handledRef.current = true;
      loginWithRedirect({
        appState: { returnTo: safePath },
      });
    }
  }, [isLoading, isAuthenticated, loginWithRedirect, safePath]);

  return <LoadingScreen message={t('auth.connecting')} />;
}
