import * as Sentry from '@sentry/react';
import { router } from '@/router';

const isEnabled = import.meta.env.VITE_SENTRY_ENABLED === 'true' || import.meta.env.PROD;

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: isEnabled && !!import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
  tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
  beforeBreadcrumb(breadcrumb) {
    if ((breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') && breadcrumb.data) {
      delete breadcrumb.data.headers?.['Authorization'];
    }
    return breadcrumb;
  },
});
