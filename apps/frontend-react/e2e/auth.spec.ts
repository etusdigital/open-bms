import { test, expect } from '@playwright/test';
import { loginViaAuth0, expectAppLoaded, getTestCredentials } from './helpers';

test.describe('Authentication', () => {
  test('should redirect unauthenticated user to Auth0 login', async ({ page, baseURL }) => {
    // Visit the app root without auth
    await page.goto(baseURL!);

    // Should redirect to login, which redirects to Auth0
    await page.waitForURL((url) => url.pathname.startsWith('/u/login') || url.pathname === '/login', {
      timeout: 15_000,
    });
  });

  test('should complete full Auth0 login flow', async ({ page, baseURL }) => {
    const { email, password } = getTestCredentials();

    await loginViaAuth0(page, { email, password, baseURL: baseURL! });

    // App should be fully loaded
    await expectAppLoaded(page);

    // Sidebar should be visible (app uses sidebar layout, no header)
    await expect(page.locator('aside')).toBeVisible();

    // URL should not be /login or /callback
    expect(page.url()).not.toContain('/login');
    expect(page.url()).not.toContain('/callback');
  });

  test('should redirect to Auth0 from login page', async ({ page, baseURL }) => {
    // Navigate to login
    await page.goto(`${baseURL}/login`);

    // The login page shows "Conectando..." briefly, then redirects to Auth0.
    // The loading screen is too transient to check reliably, so we verify
    // the full flow: login page eventually redirects to Auth0.
    await page.waitForURL((url) => url.pathname.startsWith('/u/login'), {
      timeout: 15_000,
    });
  });

  test('should show error state for invalid credentials', async ({ page, baseURL }) => {
    // Navigate to login
    await page.goto(`${baseURL}/login`);

    // Wait for Auth0 page
    await page.waitForURL((url) => url.pathname.startsWith('/u/login'), {
      timeout: 15_000,
    });

    // Enter invalid credentials
    await page.locator('input[name="username"], input[name="email"]').fill('invalid@test.com');
    await page.locator('input[name="password"]').fill('WrongPassword123!');
    await page.locator('button[data-action-button-primary="true"]').click();

    // Auth0 should show an error (stays on Auth0 page).
    // Error messages vary: "Wrong email or password", "account has been blocked", etc.
    await expect(page.getByText(/wrong|invalid|incorrect|blocked/i)).toBeVisible({ timeout: 10_000 });
  });
});
