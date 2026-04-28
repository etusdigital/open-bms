---
title: 'Setup Wizard — remover SendGrid e tornar Account obrigatório'
slug: 'setup-wizard-refactor'
created: '2026-04-28'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'NestJS (apps/msgops-api) com @nestjs/typeorm + nestjs-joi'
  - 'React + TanStack Router file-based (apps/frontend-react/src/routes/_authenticated/_layout/...)'
  - 'TypeORM + PostgreSQL (entity SystemConfigEntity, key/value JSON)'
  - 'Joi schemas (Joi.alternatives discriminated por skip)'
  - 'Zustand store (selectIsSuperAdmin selector já existente)'
files_to_modify:
  - 'apps/frontend-react/src/routes/setup.tsx'
  - 'apps/frontend-react/src/features/setup/steps/Step3Domain.tsx'
  - 'apps/frontend-react/src/features/setup/steps/Step5Pool.tsx'
  - 'apps/frontend-react/src/features/setup/steps/Step4Sendgrid.tsx (delete)'
  - 'apps/frontend-react/src/features/setup/setup.types.ts'
  - 'apps/frontend-react/src/features/settings/settings-page.tsx'
  - 'apps/frontend-react/src/features/settings/types.ts'
  - 'apps/msgops-api/src/modules/setup/setup.service.ts'
  - 'apps/msgops-api/src/modules/setup/dtos/advance-step.dto.ts'
files_to_create:
  - 'apps/frontend-react/src/features/settings/sendgrid-tab.tsx'
  - 'apps/frontend-react/src/features/settings/sendgrid-gateway.ts'
  - 'apps/msgops-api/src/modules/settings/settings.module.ts'
  - 'apps/msgops-api/src/modules/settings/settings.controller.ts'
  - 'apps/msgops-api/src/modules/settings/settings.service.ts'
  - 'apps/msgops-api/src/modules/settings/dtos/sendgrid-settings.dto.ts'
  - 'apps/msgops-api/src/lib/sendgrid-validator.ts'
code_patterns:
  - 'Step skip pattern: Joi.alternatives.try({skip:true}, {full_payload}) - step 4 vira só {skip:true}'
  - 'Auto-skip pattern: setupGateway.advanceStep({step,data:{skip:true}}) dentro do onComplete do step anterior (Step1Admin já faz pra SMTP)'
  - 'Super admin gate (backend): if (!context?.isSuperAdmin) throw ForbiddenException - ver accounts.controller.ts:33'
  - 'Super admin gate (frontend): selectIsSuperAdmin do app-store + redirect manual; sidebar usa superAdminOnly: true'
  - 'Settings UI: tabs em settings-page.tsx, SettingsTab union em types.ts, ListPage.Root layout'
  - 'Permission decorators: @PublicRoute() (setup), @RequirePermission(perm) (resto)'
  - 'system_config persistência: SystemConfigEntity key (string) + value (jsonb), lookup por key string'
test_patterns:
  - 'apps/msgops-api/src/modules/setup/setup.service.spec.ts (jest unit)'
  - 'apps/msgops-api/tests/e2e/setup.e2e-spec.ts (jest e2e)'
  - 'apps/frontend-react/src/features/setup/__tests__/setup-gateway.test.ts (vitest)'
  - 'apps/frontend-react/src/features/settings/__tests__/ (existing pattern)'
---

# Tech-Spec: Setup Wizard — remover SendGrid e tornar Account obrigatório

**Created:** 2026-04-28

## Overview

### Problem Statement

O wizard de setup atual tem dois problemas:

1. **SendGrid configurado no modelo subaccount/subuser** que não é mais usado. O passo 4 hoje pede `apiKey`, `subuserEmail`, `subuserPrefix`, `defaultIpPool` e `webhookBaseUrl`. Operação atual usa só **API key direta + webhook** — campos de subuser geram fricção desnecessária no onboarding e código morto.

2. **O passo IP Pool/Account é pulável**, e quando o admin pula, o sistema fica em estado quebrado: usuário criado sem `users_accounts` linkado → `/users/me` retorna `userAccount: []` → store cai em `setError('Nenhuma conta atribuída')` → sidebar não renderiza menus → app inutilizável até alguém criar a Account via SQL.

### Solution

Remover o passo SendGrid do wizard (frontend invisível, backend auto-skip pra preservar máquina de estado), tornar o passo IP Pool/Account obrigatório (sem botão "Pular", `accountName` already required no Joi schema do backend), e criar uma tela de configuração SendGrid pós-setup acessível só por super_admin com form simplificado (apiKey + webhookBaseUrl).

### Scope

**In Scope:**

1. **Frontend wizard (4 passos visíveis)** — Admin → Domínio → IP Pool → Health
   - Remover render de `Step4Sendgrid` em `routes/setup.tsx`
   - Atualizar arrays `STEPS`, `STEP_TITLES`, mapa `UI_FROM_BACKEND` para 4 passos
   - Renumerar visualmente 1-4 (backend continua 1-6 internamente)

2. **Auto-skip do step 4 (SendGrid) no backend** — Step3Domain dispara `advanceStep({step:4, data:{skip:true}})` no `onComplete`, antes de chamar `onComplete()` do parent. Mesmo padrão do auto-skip do SMTP (step 2) já existente em `Step1Admin.tsx:62-69`.

3. **Step5Pool obrigatório** — remover botão "Pular esta etapa" e função `handleSkip`. Backend já valida `accountName` como required no `step5Schema` (linha 104 do `advance-step.dto.ts`).

4. **Backend — `step4Schema` e `step4()`**
   - `step4Schema`: trocar `alternatives` atual por aceitar **apenas** `{ skip: true }` (remove o branch de payload completo). Bug guard caso algum cliente legado mande payload — Joi rejeita.
   - `step4()` em `setup.service.ts:254-269`: simplificar para sempre fazer `upsertWizard({currentStep: 5})` sem persistir nada (já que `data.skip` será sempre true).
   - Manter type `Step4Data` como `{ skip: true }` apenas.
   - **Não remover** o handler de `step4` nem renumerar — preserva compat com `setup_wizard_step` em DBs existentes.

5. **Nova tab "SendGrid" em `/settings`** (super_admin only)
   - **Reaproveita** página `/settings` já existente (`apps/frontend-react/src/features/settings/settings-page.tsx`) que tem padrão de tabs (`general` / `email`). Adicionar terceira tab `sendgrid`.
   - Form: `apiKey` (password input com show/hide), `webhookBaseUrl` (URL).
   - Botão "Testar credenciais" chama novo endpoint `POST /settings/sendgrid/test` (não reusa `/setup/test-sendgrid` porque o guard `ensureNotConfigured()` bloqueia uso pós-setup).
   - Salvar via `PUT /settings/sendgrid` em `system_config.sendgrid_settings` com schema novo: `{ apiKey, webhookBaseUrl }`.
   - `GET /settings/sendgrid` pra carregar valor atual (apiKey mascarada na UI).
   - **Tab visível apenas se `selectIsSuperAdmin`** — outros usuários veem só `general`/`email`.
   - **Backend gate:** `if (!context?.isSuperAdmin) throw ForbiddenException` — mesmo padrão de `accounts.controller.ts:33`.

6. **Migration / compat** — `system_config.sendgrid_settings` antigo (com `subuserEmail` etc.) é **lido** pela nova tela ignorando campos extras (Joi `stripUnknown`). Não deletamos nada — admin pode editar e re-salvar limpando os legados implicitamente.

7. **Limpeza de código morto** — `Step4Sendgrid.tsx` movido para usar como base na tela de settings (renomear/refatorar) ou deletado se não reaproveitar. `setup-gateway.testSendgrid()` continua existindo até a nova tela existir.

**Out of Scope:**

- Múltiplas API keys SendGrid ou seleção por account (mantém uma global por instância via `system_config`).
- Provedores alternativos (Postmark, SES, Mailgun) — fica para roadmap separado.
- Atualizar todos os testes — testes de `setup.service.spec.ts` referentes ao step 4 com payload completo serão atualizados na implementação; a spec não enumera diff de cada teste.
- Refatorar probe SMTP do `checkHealth()` (já tratado em sessão anterior).
- Migration SQL pra limpar campos legados de `sendgrid_settings`.
- Tela de settings genérica (`/settings/integrations`) — fica `/settings/sendgrid` específica.
- E2E novo cobrindo a tela de settings (mantém os e2e do wizard).

## Context for Development

### Codebase Patterns

**Wizard skip pattern (confirmado em `advance-step.dto.ts:78-128`):**
- `step4Schema` e `step5Schema` atualmente usam `Joi.alternatives().try(Joi.object({skip:Joi.valid(true).required()}), Joi.object({skip:Joi.valid(false).optional(), ...full_payload}))`.
- Step 4 novo: **só o primeiro alternative** (`Joi.object({skip:Joi.valid(true).required()})` direto, sem `alternatives`).
- Step 5 (Pool): manter como está — backend já tem `accountName` required no schema (linha 104), o problema do "skip" estava só no frontend.

**Auto-skip pattern (confirmado em `Step1Admin.tsx:62-69`):**
```ts
try {
  await setupGateway.advanceStep({ step: 2, data: { skip: true } });
} catch {
  // Idempotent on the backend
}
```
Mesmo bloco vai em `Step3Domain.tsx` após `advanceStep({step:3,...})` e antes de `onComplete()`, para skipar step 4 (SendGrid).

**UI step mapping (`routes/setup.tsx:35`):**
- Atual: `UI_FROM_BACKEND = { 1:1, 2:2, 3:2, 4:3, 5:4, 6:5 }` (5 passos visuais — Admin/Domínio/SendGrid/IP Pool/Health).
- Novo: `UI_FROM_BACKEND = { 1:1, 2:2, 3:2, 4:2, 5:3, 6:4 }` (4 passos — Admin/Domínio/IP Pool/Health). Backend mantém 1-6, frontend colapsa 2 (SMTP) e 4 (SendGrid) no slot 2 (Domínio) — auto-skip transparente.

**Settings page já existe (descoberta em Step 2):**
- `apps/frontend-react/src/routes/_authenticated/_layout/settings.tsx` → `apps/frontend-react/src/features/settings/settings-page.tsx`.
- Padrão de tabs em `types.ts`: `SettingsTab = 'general' | 'email'` + `SETTINGS_TABS: SettingsTab[]`.
- Render switch dentro de `<ListPage.Content>`. Adicionar `'sendgrid'` à union e ao array.
- Sidebar entry: `sidebar-config.ts:214` com `permission: 'account:settings_view'` — não é super_admin gate. **Decisão:** a tab `sendgrid` só aparece para super_admin via condicional na própria settings-page (não muda o gate da rota), backend nega 403 se request vier sem isSuperAdmin.

**Super admin gate — backend (descoberto em `accounts.controller.ts:22,33`):**
- Não existe `@RequireSuperAdmin()` decorator (foi mencionado por engano na spec inicial). Padrão real é inline: `if (!context?.isSuperAdmin) throw new ForbiddenException(...)` recebendo `context` via `@CurrentPrincipal()` decorator (verificar nome real ao implementar — provavelmente decorator que já existe no `PrincipalContextGuard`).
- Os 3 endpoints novos (`GET /settings/sendgrid`, `PUT /settings/sendgrid`, `POST /settings/sendgrid/test`) usam essa mesma checagem inline.

**Super admin gate — frontend:**
- Selector já existe: `selectIsSuperAdmin` em `app-store.ts:105`. Uso confirmado em `email-content-form.tsx:42`.
- Na settings-page, condicionar render da tab "SendGrid" e do botão da toolbar via `useAppStore(selectIsSuperAdmin)`.

**Persistência (confirmado em `setup.service.ts:267`):**
- `SystemConfigEntity` schema: `key: string PK`, `value: jsonb`, `updated_at`.
- Padrão: `await this.systemConfigRepo.save(this.systemConfigRepo.create({ key: SENDGRID_KEY, value }))` faz upsert (TypeORM `save` em row com PK existente vira UPDATE).
- Key constant: `'sendgrid_settings'` (igual ao atual — preserva continuidade).

**Lógica de teste SendGrid (extrair de `setup.service.ts:346-375`):**
- Hoje em `SetupService.testSendgrid()`: chama `axios.get('https://api.sendgrid.com/v3/user/account', {Authorization: Bearer apiKey})`, trata 200 (extrai `first_name`/`company`), 401/403 (credenciais inválidas), 429 (rate limit), erro de rede.
- Extrair pra `apps/msgops-api/src/lib/sendgrid-validator.ts` exportando `validateSendgridApiKey(apiKey: string, ip?: string, rateLimiter?): Promise<{accountName: string|null}>`.
- `setup.service.testSendgrid` e `settings.service.testSendgrid` ambos consomem.
- Rate limiter atual (`testProviderHits` Map em SetupService) não migra junto — `SettingsService` cria seu próprio Map (mesma janela 60s/5 hits). Mitigação: também extraível, mas mantém duplicado nessa primeira iteração pra reduzir risco.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `apps/frontend-react/src/routes/setup.tsx` | Atualizar `STEPS`, `STEP_TITLES`, `UI_FROM_BACKEND`, render switch (4 passos) |
| `apps/frontend-react/src/features/setup/steps/Step1Admin.tsx` | Padrão do auto-skip (referência, não muda) |
| `apps/frontend-react/src/features/setup/steps/Step3Domain.tsx` | Adicionar auto-skip de step 4 dentro do `try` antes de `onComplete()` |
| `apps/frontend-react/src/features/setup/steps/Step4Sendgrid.tsx` | **Deletar** após criar `sendgrid-tab.tsx` (lógica reaproveitada, não mantém arquivo no setup) |
| `apps/frontend-react/src/features/setup/steps/Step5Pool.tsx` | Remover state `skipping`, função `handleSkip`, botão "Pular esta etapa" (linhas 240-242) |
| `apps/frontend-react/src/features/setup/setup.types.ts` | `Step4Data = { skip: true }` apenas |
| `apps/frontend-react/src/features/setup/setup-gateway.ts` | Remover `testSendgrid` (mover pra `sendgrid-gateway.ts`) |
| `apps/frontend-react/src/features/settings/settings-page.tsx` | Render condicional da tab `'sendgrid'` se `isSuperAdmin` |
| `apps/frontend-react/src/features/settings/types.ts` | `SettingsTab = 'general' \| 'email' \| 'sendgrid'`; ajustar `SETTINGS_TABS` (filtrar dinamicamente na page) |
| `apps/msgops-api/src/modules/setup/dtos/advance-step.dto.ts` | `step4Schema` simplificado; `Step4Data` class só `skip?: boolean` |
| `apps/msgops-api/src/modules/setup/setup.service.ts:254-269` | `step4()` vira no-op + `upsertWizard({currentStep:5})`; método `testSendgrid` vira wrapper do helper |
| `apps/msgops-api/src/modules/setup/setup.service.spec.ts` | Remover specs do step 4 com payload; manter spec auto-skip |
| `apps/msgops-api/tests/e2e/setup.e2e-spec.ts` | Atualizar fluxo e2e para enviar `step:4, data:{skip:true}` |
| **NEW** `apps/msgops-api/src/lib/sendgrid-validator.ts` | Helper puro reusado por SetupService e SettingsService |
| **NEW** `apps/msgops-api/src/modules/settings/settings.module.ts` | TypeOrmModule.forFeature([SystemConfigEntity]) |
| **NEW** `apps/msgops-api/src/modules/settings/settings.controller.ts` | 3 endpoints com gate inline `isSuperAdmin` |
| **NEW** `apps/msgops-api/src/modules/settings/settings.service.ts` | get/save/test SendGrid |
| **NEW** `apps/msgops-api/src/modules/settings/dtos/sendgrid-settings.dto.ts` | Joi: `apiKey` SG.* min 10, `webhookBaseUrl` URL opcional |
| **NEW** `apps/frontend-react/src/features/settings/sendgrid-tab.tsx` | Form da tab |
| **NEW** `apps/frontend-react/src/features/settings/sendgrid-gateway.ts` | get/save/test |

### Technical Decisions

**TD-1: Manter step numbering 1-6 no backend, mas só 4 passos visíveis no frontend.**
- *Por quê:* Renumerar exigiria migration em `system_config.setup_wizard_step` em DBs existentes e quebraria semver da API. Auto-skip dos steps 2 (SMTP, já feito) e 4 (SendGrid) é solução mais simples e reversível.
- *Trade-off:* Código backend tem dois steps "vestigiais" que sempre skipam. Aceitável; documentado nos comentários.

**TD-2: Novo endpoint `POST /settings/sendgrid/test` em vez de reusar `/setup/test-sendgrid`.**
- *Por quê:* `/setup/test-sendgrid` tem `ensureNotConfigured()` que bloqueia uso pós-setup. Mexer nesse guard pra suportar dois contextos vira condicional bagunçada.
- *Solução para evitar duplicação:* extrair `validateSendgridApiKey(apiKey, ip?)` em `apps/msgops-api/src/lib/sendgrid-validator.ts` (helper puro consumido por `SetupService.testSendgrid` e `SettingsService.testSendgrid`).

**TD-3: Tab `sendgrid` dentro do `/settings` existente (não rota separada).**
- *Confirmado em Step 2:* já existe `apps/frontend-react/src/features/settings/settings-page.tsx` com padrão de tabs (`general` / `email`).
- *Decisão:* adicionar tab `'sendgrid'` na union `SettingsTab` e render condicional baseado em `selectIsSuperAdmin`.
- *Trade-off:* a página `/settings` hoje exige permission `account:settings_view`, então super_admin já passa pelo gate. A tab é renderizada/oculta no client; segurança real vem do backend (403 no PUT/POST se não-super-admin).

**TD-4: Gate de super admin via checagem inline `if (!context?.isSuperAdmin)`.**
- *Confirmado em Step 2:* não existe decorator `@RequireSuperAdmin()` (mencionado por engano antes). Padrão real é inline em `accounts.controller.ts:22,33`.
- *Implementação:* injetar `@CurrentPrincipal() context` (verificar nome real do decorator no `PrincipalContextGuard` durante implementação) e checar `context.isSuperAdmin` no início de cada handler.

**TD-5: Dados legados em `sendgrid_settings` são preservados (não deletamos `subuserEmail` etc.).**
- *Por quê:* Evita migration. Form novo lê só `apiKey`/`webhookBaseUrl`; ao salvar, escreve só esses dois campos (overwrite total da chave) — campos legados somem na primeira edição. Zero downtime, zero risco.

**TD-6: `accountName` no Step5Pool deixa de oferecer fallback "skip"; UX precisa deixar claro que é obrigatório.**
- *Por quê:* É o único campo do passo 5 que era required no Joi. Removendo o skip, o form se torna o gate único pra avançar.

## Implementation Plan

### Tasks

> **Ordem:** backend primeiro (helper → settings module → step4 simplification), depois frontend (settings tab → wizard cleanup → tests). Cada task lista arquivo, ação e notas.

- [x] **Task 1: Extrair helper `validateSendgridApiKey`**
  - File: `apps/msgops-api/src/lib/sendgrid-validator.ts` (NEW)
  - Action: Criar função pura `validateSendgridApiKey(apiKey: string): Promise<{accountName: string | null}>`. Move a lógica HTTP de `setup.service.ts:346-371` para cá. Mantém: chamada `axios.get('https://api.sendgrid.com/v3/user/account', {Authorization: Bearer ${apiKey}, timeout: 10_000, validateStatus: () => true})`, mapeamento de status → `HttpException`, log warn em 401/403 com body parcial.
  - Notes: Helper é stateless — rate limiting fica em cada service consumidor (SetupService já tem `testProviderHits` Map; SettingsService cria Map próprio).

- [x] **Task 2: Refatorar `SetupService.testSendgrid` para usar o helper**
  - File: `apps/msgops-api/src/modules/setup/setup.service.ts`
  - Action: Substituir corpo do método (linhas 346-371) por: chama `enforceTestRateLimit('sendgrid', requesterIp)`, depois `return validateSendgridApiKey(dto.apiKey)`. Remove `axios` import se ficar órfão.
  - Notes: O endpoint público `POST /setup/test-sendgrid` continua funcionando idêntico do ponto de vista do cliente.

- [x] **Task 3: Simplificar `step4Schema` e `step4()` no setup**
  - File: `apps/msgops-api/src/modules/setup/dtos/advance-step.dto.ts`
  - Action: Trocar `step4Schema` (linhas 78-95) por `Joi.object<Step2Data>({ skip: Joi.valid(true).required() })` — sem `alternatives`. Mudar classe `Step4Data` para `{ skip?: boolean }` apenas (remove apiKey/subuserEmail/etc.).
  - Notes: Cliente legado mandando payload SendGrid completo agora recebe 400 — comportamento esperado, ver AC-6.

- [x] **Task 4: Simplificar handler `step4()` em SetupService**
  - File: `apps/msgops-api/src/modules/setup/setup.service.ts:254-269`
  - Action: Substituir corpo de `private async step4(data: Step4Data)` por `await this.upsertWizard({ currentStep: 5 })`. Remove a leitura de `data` e a persistência de `system_config.sendgrid_settings`. Remove constante `SENDGRID_KEY` (linha 26) se não for usada em outro lugar do arquivo (grep antes).
  - Notes: SendGrid fica off no setup; será gravado apenas via `SettingsService` pós-setup.

- [x] **Task 5: Criar `SettingsModule` com sendgrid endpoints**
  - File: `apps/msgops-api/src/modules/settings/settings.module.ts` (NEW)
  - Action: `@Module({ imports: [TypeOrmModule.forFeature([SystemConfigEntity]), AuthModule], providers: [SettingsService], controllers: [SettingsController] })`. Registrar em `app.module.ts` na lista de imports.
  - Notes: Reusa pattern de `SetupModule`.

- [x] **Task 6: Criar `SettingsService` (sendgrid)**
  - File: `apps/msgops-api/src/modules/settings/settings.service.ts` (NEW)
  - Action: Implementar:
    - `async getSendgrid(): Promise<{apiKey: string, webhookBaseUrl?: string} | null>` — lê `system_config.sendgrid_settings`, retorna apenas `{apiKey, webhookBaseUrl}` (filtra campos legados: `subuserEmail`, `subuserPrefix`, `defaultIpPool`).
    - `async saveSendgrid(dto: SendgridSettingsDto): Promise<void>` — `systemConfigRepo.save(create({key:'sendgrid_settings', value:{apiKey,webhookBaseUrl}}))` — overwrite total da chave (limpa legado implicitamente).
    - `async testSendgrid(apiKey, ip): Promise<{accountName}>` — chama `enforceTestRateLimit` próprio + `validateSendgridApiKey(apiKey)`.
  - Notes: Janela de rate limit igual à do SetupService (60s, 5 hits) — pode duplicar a lógica `Map<key, number[]>` ou extrair `RateLimiter` num próximo passo (out of scope).

- [x] **Task 7: Criar DTO `SendgridSettingsDto`**
  - File: `apps/msgops-api/src/modules/settings/dtos/sendgrid-settings.dto.ts` (NEW)
  - Action: Classe + Joi schema: `apiKey: Joi.string().trim().pattern(/^SG\./).min(10).required()`, `webhookBaseUrl: Joi.string().uri({scheme:['http','https']}).optional()`. Reusa constantes `SENDGRID_API_KEY_PATTERN` e `SENDGRID_API_KEY_MIN_LENGTH` de `advance-step.dto.ts` (re-export ou duplica trivialmente).
  - Notes: `stripUnknown: true` no `JoiPipe` — campos extras são removidos silenciosamente (compat com payload legado).

- [x] **Task 8: Criar `SettingsController` com 3 rotas + super_admin gate**
  - File: `apps/msgops-api/src/modules/settings/settings.controller.ts` (NEW)
  - Action:
    - `GET /settings/sendgrid` → `getSendgrid()`. Gate inline `if (!ctx?.isSuperAdmin) throw new ForbiddenException()`.
    - `PUT /settings/sendgrid` → `saveSendgrid(dto)`. Mesmo gate.
    - `POST /settings/sendgrid/test` → `testSendgrid(dto.apiKey, ipAddress)`. Mesmo gate.
  - Notes: Injetar contexto via decorator existente — buscar nome real (`@CurrentPrincipal()` ou `@AuthzContext()`) em `accounts.controller.ts:22-33` ao implementar. Fallback: usar `RequirePermission('infra:manage')` se time decidir permission granular durante implementação (TD-4).

- [x] **Task 9: Frontend — atualizar wizard para 4 passos visuais**
  - File: `apps/frontend-react/src/routes/setup.tsx`
  - Action:
    1. Remover import `Step4Sendgrid` (linha 8)
    2. `STEPS` (linha 17): remover entry `{ num: 3, label: 'SendGrid' }`, renumerar para `[{num:1,label:'Admin'}, {num:2,label:'Domínio'}, {num:3,label:'IP Pool'}, {num:4,label:'Health'}]`
    3. `STEP_TITLES` (linha 26): remover key 3 (SendGrid), renumerar `2:'URL base...', 3:'IP Pool...', 4:'Verificação...'`
    4. `UI_FROM_BACKEND` (linha 35): `{ 1:1, 2:2, 3:2, 4:2, 5:3, 6:4 }`
    5. `advance()` (linha 68-70): `Math.min(s + 1, 4)`
    6. Render switch (linhas 95-99): trocar para 4 cases — `currentStep === 1 → Step1Admin`, `=== 2 → Step3Domain`, `=== 3 → Step5Pool`, `=== 4 → Step6HealthCheck`. Remove `<Step4Sendgrid baseUrl={baseUrl} />` (baseUrl deixa de ser necessário — pode remover state/setter `baseUrl`/`setBaseUrl` também).
  - Notes: Após edit, Step4Sendgrid fica órfão (deletado em Task 11).

- [x] **Task 10: Frontend — auto-skip do step 4 em Step3Domain**
  - File: `apps/frontend-react/src/features/setup/steps/Step3Domain.tsx`
  - Action: Dentro do `handleSubmit`, após `await setupGateway.advanceStep({step:3, data:{baseUrl: baseUrl.trim()}})` (linha 36) e antes de `onComplete()`, adicionar:
    ```ts
    try {
      await setupGateway.advanceStep({ step: 4, data: { skip: true } });
    } catch {
      // Idempotent on the backend
    }
    ```
  - Notes: Mesmo padrão de `Step1Admin.tsx:62-69`.

- [x] **Task 11: Frontend — remover botão "Pular" do Step5Pool**
  - File: `apps/frontend-react/src/features/setup/steps/Step5Pool.tsx`
  - Action:
    1. Remover state `skipping` (linha 29) e `setSkipping`
    2. Remover função `handleSkip` (linhas 59-73)
    3. No JSX (linha 240-242), remover `<Button ...onClick={handleSkip}>{skipping ? 'Pulando...' : 'Pular esta etapa'}</Button>`
    4. `busy` (linha 123) vira `submitting` apenas
    5. Layout do bloco final: deixar apenas botão "Voltar" (esquerda, se `onBack`) e "Salvar e continuar" (direita)
  - Notes: Validação client-side `accountName` (linha 79) já bloqueia submit vazio.

- [x] **Task 12: Frontend — deletar `Step4Sendgrid.tsx`**
  - File: `apps/frontend-react/src/features/setup/steps/Step4Sendgrid.tsx` (DELETE)
  - Action: `git rm` o arquivo. Lógica de teste/show-hide será reescrita em `sendgrid-tab.tsx` adaptada (sem subuser fields).
  - Notes: Conferir se algum import órfão sobra (grep após delete).

- [x] **Task 13: Frontend — atualizar tipos**
  - File: `apps/frontend-react/src/features/setup/setup.types.ts`
  - Action: `Step4Data = { skip: true }` apenas (remove o branch full-payload). Manter `AdvanceStepInput` union igual.
  - Notes: TypeScript vai pegar qualquer chamada órfã — espera-se que só `Step3Domain` use agora.

- [x] **Task 14: Frontend — remover `testSendgrid` do `setup-gateway`**
  - File: `apps/frontend-react/src/features/setup/setup-gateway.ts`
  - Action: Remover método `testSendgrid` (linhas 42-45) — substituído por `sendgrid-gateway.testSendgrid`.
  - Notes: Atualizar `__tests__/setup-gateway.test.ts` removendo o teste correspondente (linhas 53-57).

- [x] **Task 15: Frontend — criar `sendgrid-gateway`**
  - File: `apps/frontend-react/src/features/settings/sendgrid-gateway.ts` (NEW)
  - Action: Exportar:
    - `getSendgrid(): Promise<{apiKey:string, webhookBaseUrl?:string} | null>` → `apiClient.get('/settings/sendgrid')`
    - `saveSendgrid(payload): Promise<void>` → `apiClient.put('/settings/sendgrid', payload)`
    - `testSendgrid(apiKey): Promise<{accountName:string|null}>` → `apiClient.post('/settings/sendgrid/test', {apiKey})`
  - Notes: Usa `apiClient` autenticado (não o `http` standalone do setup).

- [x] **Task 16: Frontend — adicionar tab `sendgrid` em settings**
  - File: `apps/frontend-react/src/features/settings/types.ts`
  - Action: `SettingsTab = 'general' | 'email' | 'sendgrid'`. `SETTINGS_TABS` continua com `['general', 'email']` — tab `sendgrid` é adicionada dinamicamente na page baseada em `selectIsSuperAdmin`.

- [x] **Task 17: Frontend — render condicional da tab SendGrid**
  - File: `apps/frontend-react/src/features/settings/settings-page.tsx`
  - Action:
    1. Importar `selectIsSuperAdmin` de `@/stores/app-store` e `useAppStore`
    2. `const isSuperAdmin = useAppStore(selectIsSuperAdmin);`
    3. `const visibleTabs = useMemo(() => isSuperAdmin ? [...SETTINGS_TABS, 'sendgrid' as SettingsTab] : SETTINGS_TABS, [isSuperAdmin]);` — usar `visibleTabs` no `.map` da toolbar
    4. Adicionar render: `{tab === 'sendgrid' && isSuperAdmin && <SendgridTab />}`
    5. Importar `SendgridTab` (criado em task 18)
  - Notes: i18n — adicionar key `settings.tabSendgrid` em `pt-BR.json` e `en-US.json`.

- [x] **Task 18: Frontend — criar `SendgridTab`**
  - File: `apps/frontend-react/src/features/settings/sendgrid-tab.tsx` (NEW)
  - Action: Componente com:
    - `useEffect` que chama `getSendgrid()` on mount, popula state `apiKey`, `webhookBaseUrl`
    - Input password (com Eye/EyeOff show/hide igual ao antigo Step4) para apiKey, Input URL para webhookBaseUrl
    - Botão "Testar credenciais" (chama `testSendgrid(apiKey)`, toast sucesso/erro reusando padrão `sonner`)
    - Botão "Salvar" (valida apiKey starts SG. min 10, chama `saveSendgrid({apiKey, webhookBaseUrl})`, toast)
    - Skeleton loading enquanto carrega valor inicial
  - Notes: Reusa componentes `Button`, `Input`, `Label` do shadcn já presentes. Layout segue padrão dos outros tabs.

- [x] **Task 19: Atualizar specs do backend**
  - File: `apps/msgops-api/src/modules/setup/setup.service.spec.ts`
  - Action:
    1. Remover/atualizar testes de `step4` com payload completo (linhas 233 e 336-342 baseadas no grep prévio)
    2. Adicionar spec: `'step4 with skip:true advances to step 5 without writing system_config'`
    3. Atualizar `testSendgrid` specs (linhas 501-574) para verificar que ainda funciona (delegação ao helper)
  - Notes: Helper `validateSendgridApiKey` deve ter spec próprio em `apps/msgops-api/src/lib/__tests__/sendgrid-validator.spec.ts` (NEW) — happy path + 401/403/429/network error.

- [x] **Task 20: Criar specs para `SettingsService`**
  - File: `apps/msgops-api/src/modules/settings/__tests__/settings.service.spec.ts` (NEW)
  - Action: Specs:
    - `getSendgrid` retorna null quando key não existe
    - `getSendgrid` filtra campos legados (`subuserEmail` etc.)
    - `saveSendgrid` faz upsert com payload sanitizado
    - `testSendgrid` aplica rate limit + delega ao helper
  - Notes: Mock `SystemConfigRepository` e `validateSendgridApiKey`.

- [x] **Task 21: Atualizar e2e do setup**
  - File: `apps/msgops-api/tests/e2e/setup.e2e-spec.ts`
  - Action: No fluxo full do wizard, trocar `step:4, data:{apiKey:'SG.x',...}` por `step:4, data:{skip:true}`. Adicionar assertion ao final: `accounts` table tem 1 row, `users_accounts` tem `(user_id=admin, account_id, is_master_user=true)`.
  - Notes: Se houver test específico de "step4 com payload completo", remover.

- [x] **Task 22: Spec para `sendgrid-gateway` (frontend)**
  - File: `apps/frontend-react/src/features/settings/__tests__/sendgrid-gateway.test.ts` (NEW)
  - Action: Vitest com `apiClient` mockado — verificar URL+payload de cada método (`getSendgrid`, `saveSendgrid`, `testSendgrid`).
  - Notes: Padrão idêntico a `setup-gateway.test.ts`.

- [x] **Task 23: Smoke manual e cleanup**
  - File: N/A
  - Action:
    1. Drop DB → migrate → wizard 4 passos → admin no `/users/me` retorna `userAccount` populado
    2. Login super_admin → `/settings` → ver tab SendGrid → preencher apiKey + webhook → testar (toast OK) → salvar → reload → valor persistido
    3. Login user normal → `/settings` → tab SendGrid não aparece
    4. `curl PUT /settings/sendgrid` sem token super_admin → 403
  - Notes: Documentar resultado no PR description.

### Acceptance Criteria

**AC-1: Wizard mostra 4 passos visuais**
- **Given** admin acessa `/setup` em instância nova
- **When** página carrega
- **Then** indicador mostra 4 steps (Admin, Domínio, IP Pool, Health), nenhum SendGrid

**AC-2: Auto-skip do step 4 (SendGrid) é transparente**
- **Given** admin completou o passo 2 (Domínio)
- **When** clica "Salvar e continuar"
- **Then** request POST `/setup/advance` com step 3 (domain) sucede, request automática POST `/setup/advance` com step 4 (skip:true) sucede, UI avança pra "IP Pool e primeira conta" sem flash de SendGrid

**AC-3: Step IP Pool não pode ser pulado**
- **Given** admin chega no passo IP Pool
- **When** olha os botões disponíveis
- **Then** vê apenas "Voltar" e "Salvar e continuar" (não há "Pular esta etapa")

**AC-4: accountName é obrigatório no IP Pool**
- **Given** admin no passo IP Pool com `accountName` vazio
- **When** clica "Salvar e continuar"
- **Then** mostra erro "Nome da conta obrigatório." e form não é submetido

**AC-5: Concluir wizard cria Account e link master**
- **Given** admin preencheu accountName="Minha Empresa" no IP Pool
- **When** completa wizard até Health
- **Then** `accounts` tem row, `users_accounts` tem `(user_id=admin, account_id=novo, is_master_user=true)`, `/users/me` retorna `userAccount[0].account.id` válido, sidebar renderiza menus

**AC-6: Backend rejeita step 4 com payload SendGrid completo**
- **Given** cliente legado envia `POST /setup/advance` com `step:4, data:{apiKey:'SG.x', subuserEmail:'a@b.c'}`
- **When** Joi valida
- **Then** retorna 400 com mensagem indicando que step 4 só aceita `{skip:true}`

**AC-7: Tab "SendGrid" em `/settings` carrega config atual**
- **Given** super_admin autenticado com `system_config.sendgrid_settings = {apiKey:'SG.xxx', subuserEmail:'old@x.com', subuserPrefix:'bms'}`
- **When** acessa `/settings` e clica na tab "SendGrid"
- **Then** form mostra apiKey mascarada (igual ao valor salvo) e webhookBaseUrl vazio; campos legados `subuserEmail`/`subuserPrefix` são ignorados silenciosamente pelo gateway

**AC-8: Salvar SendGrid limpa campos legados**
- **Given** super_admin na tab SendGrid edita `apiKey=SG.new`, `webhookBaseUrl=https://app.empresa.com/bms/events`
- **When** clica "Salvar" e o request `PUT /settings/sendgrid` sucede
- **Then** `system_config.sendgrid_settings` (jsonb) contém **exatamente** `{apiKey:'SG.new', webhookBaseUrl:'https://app.empresa.com/bms/events'}` — sem `subuserEmail`, `subuserPrefix`, `defaultIpPool`

**AC-9: Testar credenciais funciona pós-setup**
- **Given** super_admin na tab SendGrid com `apiKey=SG.valid`
- **When** clica "Testar credenciais"
- **Then** `POST /settings/sendgrid/test` retorna 200 com `{accountName: ...}` e UI mostra toast verde "Credenciais válidas (conta: X)"; em 401/403 retorna mensagem de credenciais inválidas

**AC-10: Tab SendGrid oculta para não-super-admin (UI)**
- **Given** user autenticado com `effectiveRole='admin'` ou outro != `super_admin`
- **When** acessa `/settings`
- **Then** toolbar mostra apenas tabs "Geral" e "Email"; tab "SendGrid" não aparece

**AC-11: Backend rejeita não-super-admin (defesa em profundidade)**
- **Given** user com `effectiveRole='admin'` chama diretamente `GET /settings/sendgrid`, `PUT /settings/sendgrid` ou `POST /settings/sendgrid/test` (ex: via curl ou tampering no JS)
- **When** request chega ao backend
- **Then** retorna 403 Forbidden com mensagem clara

**AC-12: Rate limit no test endpoint pós-setup**
- **Given** super_admin já chamou `POST /settings/sendgrid/test` 5 vezes em 60s
- **When** chama uma 6ª vez
- **Then** recebe 429 Too Many Requests com mensagem "Muitas tentativas de teste SendGrid. Aguarde um minuto..."

## Additional Context

### Dependencies

- **Nenhuma lib nova.** Reusa: `axios`, `@nestjs/common`, `joi`, `nestjs-joi`, `typeorm`, `lucide-react`, `sonner`, shadcn UI (Button/Input/Label), Zustand store.
- **Entity:** `SystemConfigEntity` já existe (key/jsonb/updated_at).
- **Selectors:** `selectIsSuperAdmin` em `app-store.ts` já está pronto.
- **API client:** `apiClient` autenticado (`apps/frontend-react/src/lib/api-client.ts`) — usado pela tab nova; setup continua com `http` standalone do `setup-gateway`.
- **Decorator de contexto no backend:** verificar nome real (`@CurrentPrincipal()` ou similar) em `accounts.controller.ts` durante implementação. Se não existir, criar via `@Req()` lendo `req.principal` que o `PrincipalContextGuard` injeta.

### Testing Strategy

**Backend (jest unit):**
- `apps/msgops-api/src/lib/__tests__/sendgrid-validator.spec.ts` (NEW) — happy path 200, 401, 403, 429, network error, body parsing pra `accountName`.
- `apps/msgops-api/src/modules/setup/setup.service.spec.ts` — atualizar: remover testes step4 com payload, manter `testSendgrid` (delegação), adicionar `step4 with skip:true → currentStep=5, no system_config write`.
- `apps/msgops-api/src/modules/settings/__tests__/settings.service.spec.ts` (NEW) — `getSendgrid` null/legacy filter, `saveSendgrid` upsert sanitizado, `testSendgrid` rate limit.
- `apps/msgops-api/src/modules/settings/__tests__/settings-authorization.spec.ts` (NEW, padrão de `accounts-authorization.spec.ts`) — 403 sem isSuperAdmin, 200 com isSuperAdmin para os 3 endpoints.

**Backend (jest e2e):**
- `apps/msgops-api/tests/e2e/setup.e2e-spec.ts` — atualizar fluxo full: step 4 vira `{skip:true}`, assertion de `accounts.length === 1` e `users_accounts` populado.

**Frontend (vitest):**
- `apps/frontend-react/src/features/setup/__tests__/setup-gateway.test.ts` — remover teste `testSmtp` (já removido) e `testSendgrid` (este sai junto com o método).
- `apps/frontend-react/src/features/settings/__tests__/sendgrid-gateway.test.ts` (NEW) — get/save/test com `apiClient` mockado.
- Componente `SendgridTab` — opcional spec render + interação (out of scope se time apertado).

**E2E (playwright) — fora de escopo:**
- E2E completo da tab SendGrid não está incluído nesta spec.

**Manual (smoke):**
1. **Wizard novo:** drop DB → start API → `/setup` → 4 passos visuais → completar com `accountName="Teste"` → login → `/users/me` retorna `userAccount[0].account.id`, sidebar com menus.
2. **Tab SendGrid (super_admin):** `/settings` → tab "SendGrid" visível → carregar (vazio na 1ª vez) → preencher apiKey válida → "Testar" toast OK → "Salvar" → reload → valor persistido (apiKey mascarada).
3. **Limpeza de legado:** SQL pré-popula `sendgrid_settings={apiKey:'SG.x',subuserEmail:'old@x.com'}` → abrir tab → ver só apiKey carregada → salvar → SQL `SELECT value FROM system_config WHERE key='sendgrid_settings'` retorna apenas `{apiKey, webhookBaseUrl}`.
4. **Não-super-admin:** login user `admin` → `/settings` → tab "SendGrid" oculta → `curl PUT /settings/sendgrid` direto → 403.
5. **Rate limit:** chamar `/settings/sendgrid/test` 6x rápido → 6º retorna 429.

### Notes

- **Bug origem desta spec:** sessão atual — usuário (Davidson) concluiu wizard clicando "Pular esta etapa" no IP Pool por engano. Sistema ficou sem `Account` linkada → `/users/me` com `userAccount: []` → store em estado de erro → sidebar vazio. Workaround: Account criada via SQL. Esta spec elimina o caminho.
- **ClickHouse `ECONNREFUSED ::1:8123`:** observado em `setup.service.checkHealth()` — não é regressão desta spec, é ambiente local sem container ClickHouse subido. Fora do escopo.
- **`setup_complete.skipReason`:** hoje grava "Administrador optou por concluir com serviços com falha." quando health falha — comportamento preservado, fora do escopo.
- **Migration de dados:** **não há.** Compat é via `stripUnknown` (Joi) + overwrite na primeira edição da tab. Instalações antigas com `subuserEmail` etc. continuam funcionando (campos ignorados pelo `getSendgrid`); ao primeiro save, ficam limpos.
- **Step numbering 1-6 preservado no backend:** decisão consciente (TD-1) para evitar migration em `system_config.setup_wizard_step`. Custo: 2 steps "vestigiais" (2=SMTP, 4=SendGrid) que sempre auto-skip. Documentar no comentário do `setup.service.ts` para evitar confusão futura.
- **`setup-gateway.testSendgrid` removido** — endpoint `/setup/test-sendgrid` continua existindo no backend (para compat com clientes antigos do wizard, caso alguma instalação tenha cache de bundle), mas o frontend novo não usa mais. Pode ser removido em PR futuro junto com `/setup/test-smtp` e o método `testSmtp` (já órfão).
- **Out of escopo, vale citar:** quando aparecer um segundo provedor (Postmark/SES), refatorar para `/settings/integrations` genérica. Por enquanto tab dedicada.
- **Rate limiter duplicado** entre `SetupService` e `SettingsService`: aceitável nesta iteração; extração de `RateLimiter` reutilizável fica para refactor futuro.
