import { type Page, expect } from '@playwright/test';

const AUTH_PROVIDER = (process.env.VITE_AUTH_PROVIDER ?? 'local') as 'local' | 'auth0';

/**
 * Performs login via the local form OR Auth0 Universal Login depending on
 * the active provider mode. Both end with the user landing on a non-login
 * page in the app origin.
 */
export async function login(page: Page, options: { email: string; password: string; baseURL: string }) {
  if (AUTH_PROVIDER === 'auth0') {
    return loginViaAuth0(page, options);
  }
  return loginViaLocalForm(page, options);
}

/** Backwards-compatible alias used by `auth.setup.ts` files in the wild. */
export const loginViaAuth0 = (page: Page, options: { email: string; password: string; baseURL: string }) =>
  loginViaUniversalLogin(page, options);

async function loginViaUniversalLogin(
  page: Page,
  options: { email: string; password: string; baseURL: string },
) {
  await page.goto(`${options.baseURL}/login`);

  await page.waitForURL((url) => url.pathname.startsWith('/u/login'), {
    timeout: 15_000,
  });

  await page.locator('input[name="username"], input[name="email"]').fill(options.email);
  await page.locator('input[name="password"]').fill(options.password);
  await page.locator('button[data-action-button-primary="true"]').click();

  await page.waitForURL(
    (url) => {
      const isApp = url.origin === options.baseURL;
      const path = url.pathname;
      return isApp && path !== '/login' && path !== '/callback';
    },
    { timeout: 30_000 },
  );
}

async function loginViaLocalForm(
  page: Page,
  options: { email: string; password: string; baseURL: string },
) {
  await page.goto(`${options.baseURL}/login`);

  // The local form lives directly on /login.
  await page.waitForURL((url) => url.pathname === '/login', { timeout: 10_000 });

  await page.locator('input#login-email').fill(options.email);
  await page.locator('input#login-password').fill(options.password);
  await page.getByRole('button', { name: /entrar/i }).click();

  await page.waitForURL(
    (url) => url.origin === options.baseURL && url.pathname !== '/login',
    { timeout: 20_000 },
  );
}

export async function expectAppLoaded(page: Page) {
  await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('aside img[alt="Etus"], aside img[alt="BMS"]').first()).toBeVisible();
  await expect(page.locator('button[role="combobox"]')).toBeVisible();
}

export function getTestCredentials() {
  const email = process.env.E2E_TEST_USER_EMAIL;
  const password = process.env.E2E_TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E test credentials not configured. Set E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD in .env or CI environment.',
    );
  }

  return { email, password };
}
