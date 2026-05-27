import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import axios from 'axios';
import { LoadingScreen } from '@/components/loading-screen';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/use-auth';

const AUTH_PROVIDER = (import.meta.env.VITE_AUTH_PROVIDER ?? 'local') as 'local' | 'auth0';

const loginSearchSchema = z.object({
  returnTo: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  component: LoginPage,
});

function safePath(returnTo: string | undefined): string {
  if (!returnTo) return '/';
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return '/';
  return returnTo;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginPage() {
  const { isAuthenticated, isLoading, login, loginWithRedirect } = useAuth();
  const { returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const handledRef = useRef(false);

  const target = safePath(returnTo);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !handledRef.current) {
      handledRef.current = true;
      navigate({ to: target, replace: true });
    }
  }, [isLoading, isAuthenticated, navigate, target]);

  if (AUTH_PROVIDER === 'auth0') {
    return <Auth0LoginRedirect target={target} loginWithRedirect={loginWithRedirect} />;
  }

  return <LocalLoginForm login={login} />;
}

function Auth0LoginRedirect({
  target,
  loginWithRedirect,
}: {
  target: string;
  loginWithRedirect: ReturnType<typeof useAuth>['loginWithRedirect'];
}) {
  const { t } = useTranslation();
  const { isLoading } = useAuth();
  const triggeredRef = useRef(false);

  useEffect(() => {
    // Wait for the Auth0 bridge to register itself before invoking
    // loginWithRedirect — otherwise the call falls back to a `/login`
    // navigation and produces an infinite loop.
    if (isLoading || triggeredRef.current) return;
    triggeredRef.current = true;
    loginWithRedirect({ appState: { returnTo: target } });
  }, [isLoading, loginWithRedirect, target]);

  return <LoadingScreen message={t('auth.connecting')} />;
}

function LocalLoginForm({ login }: { login: ReturnType<typeof useAuth>['login'] }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!EMAIL_RE.test(email)) return 'Informe um e-mail válido.';
    if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
    return null;
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const localErr = validate();
    if (localErr) {
      setError(localErr);
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      // Don't navigate here — login() flips isAuthenticated, which triggers
      // the effect at the top of LoginPage to navigate. Calling navigate
      // here too would race against that effect.
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError('E-mail ou senha inválidos.');
      } else {
        setError('Não foi possível fazer login. Tente novamente em alguns instantes.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-background flex min-h-screen w-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <img src="/logo.png" alt="BMS" className="h-12 w-12 object-contain" />
          <h1 className="text-foreground text-xl font-semibold">Entrar no BMS</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-card border-border flex flex-col gap-4 rounded-2xl border px-6 py-6 shadow-sm"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-email">E-mail</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-password">Senha</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={submitting} className="mt-2">
            {submitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
