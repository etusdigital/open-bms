import { test, expect } from '@playwright/test';

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile');
    await expect(page.locator('aside')).toBeVisible({ timeout: 30_000 });
  });

  test('should display all profile sections', async ({ page }) => {
    await expect(page.getByText('Foto de perfil')).toBeVisible();
    await expect(page.getByText('Informações pessoais')).toBeVisible();
  });

  test('should pre-fill name and email from authenticated user', async ({ page }) => {
    const nameInput = page.getByLabel('Nome');
    const emailInput = page.getByLabel('Email');

    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();

    // Fields should be pre-filled (not empty)
    const nameValue = await nameInput.inputValue();
    const emailValue = await emailInput.inputValue();
    expect(nameValue.length).toBeGreaterThan(0);
    expect(emailValue).toContain('@');
  });

  test('should call PUT /users/me when saving profile', async ({ page }) => {
    const apiURL = process.env.VITE_API_URL || '/api';

    // Intercept the PUT /users/me request
    const requestPromise = page.waitForRequest(
      (req) => req.method() === 'PUT' && req.url().includes('/users/me') && !req.url().includes('/password'),
      { timeout: 10_000 },
    );

    // Mock the response so we don't mutate real data
    await page.route('**/users/me', (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({ status: 200, json: {} });
      }
      return route.continue();
    });

    // Submit the profile form
    const saveButton = page.getByRole('button', { name: /salvar/i });
    await saveButton.click();

    const request = await requestPromise;
    const body = request.postDataJSON();

    // Should hit /users/me, not /users/{id}
    expect(request.url()).toMatch(/\/users\/me$/);
    expect(request.url()).not.toMatch(/\/users\/\d+$/);

    // Payload should contain profile fields, not userId
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('email');
    expect(body).toHaveProperty('settings');
    expect(body).not.toHaveProperty('userId');
  });

  test('should call PUT /users/me/password when changing password (database user)', async ({ page }) => {
    // Password section only shows for auth0| database users
    const passwordSection = page.getByText('Alterar senha');
    if (!(await passwordSection.isVisible().catch(() => false))) {
      test.skip(true, 'Test user is a social login user — no password section');
      return;
    }

    // Mock the password endpoint
    await page.route('**/users/me/password', (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({ status: 200, json: {} });
      }
      return route.continue();
    });

    const requestPromise = page.waitForRequest(
      (req) => req.method() === 'PUT' && req.url().includes('/users/me/password'),
      { timeout: 10_000 },
    );

    // Fill password fields with a valid password (10+ chars, 3+ character types)
    // Labels aren't linked to inputs (Slot.Root merges id onto wrapper div),
    // so locate textboxes relative to their label text within the form item
    const password = 'TestPass123!';
    const passwordCard = page.locator('[data-slot="form-item"]', {
      has: page.getByText('Nova senha'),
    });
    const confirmCard = page.locator('[data-slot="form-item"]', {
      has: page.getByText('Confirmar senha'),
    });
    await passwordCard.getByRole('textbox').fill(password);
    await confirmCard.getByRole('textbox').fill(password);

    // Submit password form
    const updateButton = page.getByRole('button', {
      name: /atualizar senha/i,
    });
    await updateButton.click();

    const request = await requestPromise;
    const body = request.postDataJSON();

    // Should hit /users/me/password, not /users/update-password/{id}
    expect(request.url()).toMatch(/\/users\/me\/password$/);
    expect(request.url()).not.toMatch(/\/users\/update-password\//);

    // Payload should contain only password, not providerId or userId
    expect(body).toEqual({ password });
  });

  test('should call POST /users/me/profile-picture when uploading avatar', async ({ page }) => {
    // Mock the profile picture endpoint
    await page.route('**/users/me/profile-picture', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          json: { profile: 'https://cdn.example.com/new-pic.jpg' },
        });
      }
      return route.continue();
    });

    const requestPromise = page.waitForRequest(
      (req) => req.method() === 'POST' && req.url().includes('/users/me/profile-picture'),
      { timeout: 10_000 },
    );

    // Upload a file via the hidden input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image-data'),
    });

    const request = await requestPromise;
    const body = request.postDataJSON();

    // Should hit /users/me/profile-picture, not /buckets
    expect(request.url()).toMatch(/\/users\/me\/profile-picture$/);
    expect(request.url()).not.toMatch(/\/buckets/);

    // Payload should have name and base64 data
    expect(body).toHaveProperty('name', 'avatar.png');
    expect(body).toHaveProperty('data');
  });
});
