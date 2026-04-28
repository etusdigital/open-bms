import { test as setup } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { loginViaAuth0, expectAppLoaded, getTestCredentials } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AUTH_STATE_PATH = resolve(__dirname, '.auth/state.json');

/**
 * Authenticates once via Auth0 and saves browser state (cookies + storage)
 * for reuse by all authenticated test projects.
 */
setup('authenticate via Auth0', async ({ page, baseURL }) => {
  const { email, password } = getTestCredentials();

  await loginViaAuth0(page, { email, password, baseURL: baseURL! });

  // Verify the app loaded successfully after login
  await expectAppLoaded(page);

  // Save authenticated state for reuse
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
