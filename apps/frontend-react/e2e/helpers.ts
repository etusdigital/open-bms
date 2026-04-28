import { type Page, expect } from '@playwright/test';

/**
 * Performs Auth0 Universal Login through the UI.
 * Handles the redirect to Auth0, fills credentials, and waits for callback.
 */
export async function loginViaAuth0(page: Page, options: { email: string; password: string; baseURL: string }) {
  // Navigate to login — triggers Auth0 redirect
  await page.goto(`${options.baseURL}/login`);

  // Wait for Auth0 login page to load
  await page.waitForURL((url) => url.pathname.startsWith('/u/login'), {
    timeout: 15_000,
  });

  // Fill credentials on Auth0 Universal Login page
  await page.locator('input[name="username"], input[name="email"]').fill(options.email);
  await page.locator('input[name="password"]').fill(options.password);

  // Click the primary submit button (not "Continue with Google")
  await page.locator('button[data-action-button-primary="true"]').click();

  // Wait for redirect back to the app (callback or home)
  await page.waitForURL(
    (url) => {
      const isApp = url.origin === options.baseURL;
      const path = url.pathname;
      return isApp && path !== '/login' && path !== '/callback';
    },
    { timeout: 30_000 },
  );
}

/**
 * Asserts the app has fully loaded after authentication.
 * Checks for sidebar (logo, account selector) — no header in new layout.
 */
export async function expectAppLoaded(page: Page) {
  // Sidebar should be visible
  await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });

  // Logo in sidebar should be visible
  await expect(page.locator('aside img[alt="Etus"]')).toBeVisible();

  // Account selector button should be visible
  await expect(page.locator('button[role="combobox"]')).toBeVisible();
}

/**
 * Returns test credentials from environment variables.
 * Throws if not configured.
 */
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
