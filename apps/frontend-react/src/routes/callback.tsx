import { useEffect, useRef } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuth0 } from '@auth0/auth0-react';
import { useTranslation } from 'react-i18next';
import { LoadingScreen } from '@/components/loading-screen';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/callback')({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const { error, isLoading, isAuthenticated, logout } = useAuth0();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const navigatedRef = useRef(false);

  // After Auth0 finishes and user is authenticated, navigate to the saved returnTo path.
  // This fires after React state is updated, so beforeLoad sees the correct context.
  useEffect(() => {
    if (!isLoading && isAuthenticated && !navigatedRef.current) {
      navigatedRef.current = true;
      const returnTo = sessionStorage.getItem('auth_return_to') || '/';
      sessionStorage.removeItem('auth_return_to');
      navigate({ to: returnTo, replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <img src="/logo.png" alt="Etus" className="h-12 w-12" />
        <h1 className="text-lg font-semibold">{t('auth.error')}</h1>
        <p className="text-muted-foreground text-sm">{error.message}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: '/login' })}>
            {t('auth.tryAgain')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin + '/login' } })}
          >
            {t('auth.logout')}
          </Button>
        </div>
      </div>
    );
  }

  return <LoadingScreen message={t('auth.connecting')} />;
}
