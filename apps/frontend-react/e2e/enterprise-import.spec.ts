/**
 * Playwright e2e.
 *
 * Scenarios:
 * - Phase 1 (super-admin): login → /super-admin/accounts/import-enterprise → fill
 *   the form against a mock backend → watch polling progress → completion.
 * - Phase 2 (wizard): new instance, Step2EnterpriseImport renders, "Skip" works,
 *   redirects to Step3Domain.
 * - Phase 2 (wizard with import): fill → watch simplified progress → continue anyway.
 * - Enterprise 4xx mock: status=failed → resume dialog.
 *
 * Mocks use msw at runtime or Playwright interceptors.
 *
 * Prerequisites: dev server up, super-admin seeded, API mock available.
 */

import { test, expect } from '@playwright/test';

test.describe('Enterprise import — super-admin flow (Fase 1)', () => {
  test.skip('TODO: login + form + progress + completion', async ({ page }) => {
    await page.goto('/super-admin/accounts/import-enterprise');
    await expect(page.getByRole('heading', { name: 'Importar conta do Enterprise' })).toBeVisible();
    // ...
  });
});

test.describe('Enterprise import — wizard Step2 (Fase 2)', () => {
  test.skip('TODO: skip advances to Step3', async ({ page }) => {
    await page.goto('/setup');
    // ... fill Step1, reach Step2, click "Skip"
    // Expect Step3Domain visible
  });

  test.skip('TODO: 4xx error shows failed status + resume dialog', async ({ page }) => {
    // ... mock 401 on /accounts/import, assert Alert + Resume button
  });
});
