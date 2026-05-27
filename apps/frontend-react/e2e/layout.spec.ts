import { test, expect } from '@playwright/test';

// This test suite uses saved auth state from auth.setup.ts
// (configured via the 'authenticated' project in playwright.config.ts)

test.describe('Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the sidebar to load with auth state
    await expect(page.locator('aside')).toBeVisible({ timeout: 30_000 });
  });

  test('should display the sidebar with logo', async ({ page }) => {
    const logo = page.locator('aside img[alt="Etus"]');
    await expect(logo).toBeVisible();
  });

  test('should display account selector in sidebar', async ({ page }) => {
    const accountSelector = page.locator('button[role="combobox"]');
    await expect(accountSelector).toBeVisible();

    // Should display the current account name
    const text = await accountSelector.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('should open account selector and show search', async ({ page }) => {
    await page.locator('button[role="combobox"]').click();
    await expect(page.getByPlaceholder('Buscar conta...')).toBeVisible();
  });

  test('should display user info in sidebar', async ({ page }) => {
    const sidebar = page.locator('aside');
    // User avatar should be visible in sidebar bottom section
    const avatar = sidebar.locator('img[alt]').last();
    await expect(avatar).toBeVisible();
  });

  test('should display sign out button', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('button', { name: 'Sair' })).toBeVisible();
  });

  test('should display sidebar with navigation items', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Should have navigation links
    const navLinks = sidebar.locator('a, button');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(3);
  });

  test('should collapse and expand sidebar', async ({ page }) => {
    const sidebar = page.locator('aside');

    // Find collapse button
    const collapseButton = sidebar.getByText('Recolher menu');
    await expect(collapseButton).toBeVisible();
    await collapseButton.click();

    // Sidebar should be narrower (icon-only width = 3.5rem = 56px)
    await expect(sidebar).toHaveCSS('width', '56px', { timeout: 1000 });

    // Expand button should now be visible (last button in collapsed sidebar)
    const expandButton = sidebar.locator('button').last();
    await expandButton.click();

    // Sidebar should be wider again
    await expect(sidebar).not.toHaveCSS('width', '56px', { timeout: 1000 });
  });

  test('should navigate to a page when clicking sidebar link', async ({ page }) => {
    const sidebar = page.locator('aside');

    // Click on a visible link in the sidebar
    const firstLink = sidebar.locator('a').first();
    const href = await firstLink.getAttribute('href');

    if (href) {
      await firstLink.click();
      await page.waitForURL((url) => url.pathname === href, {
        timeout: 5_000,
      });
      expect(page.url()).toContain(href);
    }
  });

  test('should show placeholder page for unimplemented routes', async ({ page }) => {
    await page.goto('/templates');
    await expect(page.getByText('Em construção')).toBeVisible({
      timeout: 15_000,
    });
  });
});
