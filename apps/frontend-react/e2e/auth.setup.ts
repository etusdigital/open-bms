import { test as setup } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { login, expectAppLoaded, getTestCredentials } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AUTH_STATE_PATH = resolve(__dirname, '.auth/state.json');

/**
 * Authenticates once and saves browser state (cookies + storage) for reuse
 * by all authenticated test projects. Selects local form vs Auth0 based on
 * VITE_AUTH_PROVIDER.
 */
setup('authenticate', async ({ page, baseURL }) => {
  const { email, password } = getTestCredentials();

  await login(page, { email, password, baseURL: baseURL! });

  await expectAppLoaded(page);

  await page.context().storageState({ path: AUTH_STATE_PATH });
});
