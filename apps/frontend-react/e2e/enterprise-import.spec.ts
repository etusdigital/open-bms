/**
 * Playwright e2e (Task 35).
 *
 * Cenários:
 * - Fase 1 (super-admin): login → /super-admin/accounts/import-enterprise → preencher form
 *   com mock backend → ver progresso polling → conclusão.
 * - Fase 2 (wizard): instância nova, Step2EnterpriseImport renderiza, "Pular" funciona,
 *   redireciona pra Step3Domain.
 * - Fase 2 (wizard com import): preencher → ver progresso simplificado → continuar mesmo assim.
 * - 4xx mock no Enterprise: status=failed → diálogo de retomar.
 *
 * Mocks usam msw em runtime ou interceptors do Playwright.
 *
 * Pré-requisitos: dev server up, super-admin seedado, API mock disponível.
 */

import { test, expect } from '@playwright/test';

test.describe('Enterprise import — super-admin flow (Fase 1)', () => {
  test.skip('TODO: login + form + progresso + conclusão', async ({ page }) => {
    await page.goto('/super-admin/accounts/import-enterprise');
    await expect(page.getByRole('heading', { name: 'Importar conta do Enterprise' })).toBeVisible();
    // ...
  });
});

test.describe('Enterprise import — wizard Step2 (Fase 2)', () => {
  test.skip('TODO: pular avança para Step3', async ({ page }) => {
    await page.goto('/setup');
    // ... preencher Step1, chegar ao Step2, clicar "Pular"
    // Esperar Step3Domain visível
  });

  test.skip('TODO: erro 4xx mostra status failed + dialog de retomar', async ({ page }) => {
    // ... mockar 401 no /accounts/import, validar Alert + botão Retomar
  });
});
