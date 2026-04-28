import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the app directory (same file used for Vite dev)
dotenv.config({ path: resolve(__dirname, '.env') });

const baseURL = 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 60_000,

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    // Auth setup: runs first, authenticates, saves state for dependent tests
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
    },

    // Auth flow test: tests the actual login UI (does NOT depend on saved state)
    {
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
    },

    // Authenticated tests: depend on auth-setup for saved state
    {
      name: 'authenticated',
      testMatch: /(?:layout|profile)\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        storageState: resolve(__dirname, 'e2e/.auth/state.json'),
      },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
