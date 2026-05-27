import { test, expect } from '@playwright/test';
import { login, expectAppLoaded, getTestCredentials } from './helpers';

const AUTH_PROVIDER = (process.env.VITE_AUTH_PROVIDER ?? 'local') as 'local' | 'auth0';

test.describe('Authentication', () => {
  test('redirects unauthenticated user to /login (local) or Auth0 universal login', async ({ page, baseURL }) => {
    await page.goto(baseURL!);

    await page.waitForURL((url) => url.pathname.startsWith('/u/login') || url.pathname === '/login', {
      timeout: 15_000,
    });
  });

  test('completes full login flow', async ({ page, baseURL }) => {
    const { email, password } = getTestCredentials();
    await login(page, { email, password, baseURL: baseURL! });

    await expectAppLoaded(page);
    expect(page.url()).not.toContain('/login');
    expect(page.url()).not.toContain('/callback');
  });

  test('access token is never written to localStorage or sessionStorage (local mode)', async ({ page, baseURL }) => {
    test.skip(AUTH_PROVIDER !== 'local', 'Token-in-memory invariant is local-mode-specific');
    const { email, password } = getTestCredentials();
    await login(page, { email, password, baseURL: baseURL! });
    await expectAppLoaded(page);

    const localKeys = await page.evaluate(() => Object.keys(localStorage).map((k) => `${k}=${localStorage.getItem(k)}`));
    const sessionKeys = await page.evaluate(() => Object.keys(sessionStorage).map((k) => `${k}=${sessionStorage.getItem(k)}`));

    // Heuristic: a JWT contains two dots and has a header `eyJ...`. If any
    // value matches that shape, fail.
    const jwtRe = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
    expect(localKeys.some((v) => jwtRe.test(v))).toBe(false);
    expect(sessionKeys.some((v) => jwtRe.test(v))).toBe(false);
  });

  test('session persists across hard reload (local mode)', async ({ page, baseURL }) => {
    test.skip(AUTH_PROVIDER !== 'local', 'silent refresh via cookie is local-mode-specific');
    const { email, password } = getTestCredentials();
    await login(page, { email, password, baseURL: baseURL! });
    await expectAppLoaded(page);

    await page.reload();

    // After reload the bms_refresh cookie should silently refresh and the
    // user lands back inside the app (NOT on /login).
    await page.waitForURL((url) => url.origin === baseURL && url.pathname !== '/login', {
      timeout: 20_000,
    });
    await expectAppLoaded(page);
  });

  test('shows generic error for invalid credentials (local mode)', async ({ page, baseURL }) => {
    test.skip(AUTH_PROVIDER !== 'local', 'Local form. Auth0 invalid-credentials test stays on the universal login page.');

    await page.goto(`${baseURL}/login`);
    await page.locator('input#login-email').fill('nope@example.com');
    await page.locator('input#login-password').fill('WrongPassword123!');
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('shows error for invalid credentials (auth0 mode)', async ({ page, baseURL }) => {
    test.skip(AUTH_PROVIDER !== 'auth0', 'Auth0-specific universal login error path');

    await page.goto(`${baseURL}/login`);
    await page.waitForURL((url) => url.pathname.startsWith('/u/login'), { timeout: 15_000 });

    await page.locator('input[name="username"], input[name="email"]').fill('invalid@test.com');
    await page.locator('input[name="password"]').fill('WrongPassword123!');
    await page.locator('button[data-action-button-primary="true"]').click();

    await expect(page.getByText(/wrong|invalid|incorrect|blocked/i)).toBeVisible({ timeout: 10_000 });
  });
});
