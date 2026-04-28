/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_PROVIDER?: 'local' | 'auth0';
  readonly VITE_AUTH0_DOMAIN?: string;
  readonly VITE_AUTH0_CLIENT_ID?: string;
  readonly VITE_AUTH0_AUDIENCE?: string;
  readonly VITE_API_URL: string;
  readonly VITE_REDIRECT_MANAGER_URL: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_SENTRY_ENABLED: string;
  readonly VITE_CLARITY_PROJECT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
