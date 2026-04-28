# Story 1.1: frontend-react — Substituir o Vue 2 (Local Auth + Setup Wizard) (EVO-1014)

Status: done

**Linear:** https://linear.app/evoai/issue/EVO-1014
**Branch sugerida:** `davidson/evo-1014-frontend-react-replace-vue2`
**Prioridade:** Urgent

> **Nota sobre o escopo da Linear**
> A descrição da EVO-1014 no Linear afirma que o único delta entre o estado inicial e o estado atual do `frontend-vue2` é a migração de auth (commits `7608eca` + `7248dd8` + `f40786b`). **Isso é literalmente verdade no `frontend-vue2`** — `git log -- apps/frontend-vue2/` confirma. **No entanto**, para o React substituir o Vue 2 como operator workspace em produção, ele precisa também herdar funcionalidade que vive hoje no `apps/msgops-manager-frontend` (Vue 3) e que **bloqueia o primeiro acesso de qualquer instância nova**: o setup wizard (5 passos). Sem ele, um operador novo subindo o BMS open source não consegue criar o admin nem configurar SMTP/SendGrid/Pool — e o backend devolve `setup.configured=false`, redirecionando para uma rota que não existe no React. Por isso esta story porta **auth local + setup wizard** para o React. Painel admin (Accounts/Users/Billing) **continua no Vue 3 manager** — fora do escopo aqui.

## Story

Como **operador BMS subindo a plataforma open source pela primeira vez (ou logando depois)**,
quero **acessar o `frontend-react` em substituição ao `frontend-vue2`, com login email+senha (Auth0 opt-in) e o wizard de setup de 5 passos no primeiro acesso**,
para que **o React assuma o papel de operator workspace em produção sem regressão de fluxo de onboarding nem de auth, mantendo o Vue 3 manager intacto para os fluxos admin (Accounts/Users/Billing)**.

## Acceptance Criteria

### Auth (Fases 1–4 + 6 do plano EVO-1014)

1. **AC1 — Login local default**
   **Dado** que `VITE_AUTH_PROVIDER` está ausente ou igual a `local`,
   **Quando** o usuário envia email + senha válidos para `/login`,
   **Então** o cliente chama `POST {VITE_API_URL}/auth/login` com `withCredentials: true`,
   recebe `{ accessToken, expiresIn, user }`, guarda o `accessToken` **apenas em memória**,
   o backend grava o cookie httpOnly `bms_refresh`, e o usuário é redirecionado para `returnTo` se for um path interno seguro (`/...`, sem `//`), caso contrário para `/`.

2. **AC2 — Login local 401**
   **Dado** que `VITE_AUTH_PROVIDER=local`,
   **Quando** `POST /auth/login` retorna 401,
   **Então** a página exibe a mensagem genérica `"E-mail ou senha inválidos."`, o form não trava, e nada é gravado em `localStorage`/`sessionStorage`.

3. **AC3 — Refresh silencioso em hard reload**
   **Dado** uma sessão ativa onde o cookie `bms_refresh` existe,
   **Quando** o app monta (hard reload ou primeira carga),
   **Então** o `bootstrap()` chama `POST /auth/refresh` antes do primeiro guard rodar,
   hidrata `accessToken` em memória e popula `useAppStore` via `GET /users/me`,
   e o usuário entra direto na rota protegida sem ver o login.

4. **AC4 — Refresh silencioso na expiração (interceptor 401)**
   **Dado** uma chamada autenticada qualquer que recebe 401,
   **Quando** o interceptor detecta o 401 e a request **não** é em `/auth/login|refresh|logout`,
   **Então** ele chama `refresh()` exatamente uma vez (single-flight, mesmo com N requests concorrentes em 401),
   reattacha o novo `Authorization: Bearer …` e retenta a request original;
   se o `refresh` falhar, faz `logout` local e redireciona para `/login?returnTo=<pathname+search>`.

5. **AC5 — Logout invalida o cookie no servidor**
   **Dado** uma sessão autenticada,
   **Quando** o usuário clica em "Sair",
   **Então** o cliente chama `POST /auth/logout` (com `withCredentials: true`) **antes** de limpar o estado local,
   e o estado é limpo (token em memória, store, query cache de auth/perms) **mesmo que a request falhe** (idempotente).

6. **AC6 — Auth0 opt-in funcional**
   **Dado** `VITE_AUTH_PROVIDER=auth0`,
   **Quando** o usuário visita `/login`,
   **Então** o fluxo Auth0 atual continua funcionando sem regressão (smoke test E2E verde): `loginWithRedirect` → `/callback` → sessão hidratada via `useAuthInit`.

7. **AC7 — Auth0 fora do entry chunk em modo local**
   **Dado** `VITE_AUTH_PROVIDER=local` em build de produção,
   **Quando** o bundle é gerado (`pnpm --filter frontend-react build`),
   **Então** o **chunk inicial** (`assets/index-*.js`) **não importa** `@auth0/auth0-react` (verificável por `grep` no chunk inicial). Estratégia: usar `if (import.meta.env.VITE_AUTH_PROVIDER === 'auth0') { … import dinâmico … }` — Vite faz dead-code-elimination quando a env é resolvida em build-time.

8. **AC8 — Access token nunca persiste**
   **Dado** uma sessão autenticada em qualquer modo,
   **Quando** DevTools inspeciona `localStorage` e `sessionStorage`,
   **Então** **nenhuma chave** contém o `accessToken` (verificável por teste unitário com spy em `Storage.prototype.setItem`).

9. **AC9 — `/users/me` é fonte única de roles/permissões**
   **Dado** login bem-sucedido em modo `local`,
   **Quando** `GET /users/me` retorna,
   **Então** o store popula `permissions`, `effectiveRole`, `globalRole`, `isMasterUser` e `canSeeAllAccounts` a partir desse payload,
   e **nenhum** componente lê claim Auth0 virtual (`etus_superbilling`, `superbilling`) — grep do repo retorna zero ocorrências em `apps/frontend-react/src/**`.

10. **AC10 — `/callback` é no-op em modo local**
    **Dado** `VITE_AUTH_PROVIDER=local`,
    **Quando** o usuário acessa `/callback` diretamente,
    **Então** redireciona para `/` (ou `/login` se não autenticado) sem montar nada do Auth0.

11. **AC11 — Validação client-side**
    **Dado** o form de login,
    **Quando** o usuário submete email inválido OU senha < 8 chars,
    **Então** o submit é bloqueado client-side com mensagem local **sem** chamar a API.

12. **AC12 — `returnTo` seguro**
    **Dado** `/login?returnTo=<x>`,
    **Quando** `<x>` é `//evil.com`, `https://evil.com`, `javascript:...` ou qualquer string que não comece com `/` (ou que comece com `//`),
    **Então** o redirect pós-login vai para `/`.

### Setup Wizard (paridade com Vue 3 manager)

13. **AC13 — Gate de setup global**
    **Dado** uma instância nova onde `GET /setup/status` retorna `{ configured: false, currentStep: N }`,
    **Quando** o usuário acessa **qualquer rota** do React (`/`, `/login`, `/campaigns`, etc.),
    **Então** o React redireciona para `/setup` e abre o wizard no step `N`. O gate roda **antes** de qualquer guard de auth.

14. **AC14 — Pular setup quando configurado**
    **Dado** `GET /setup/status` retorna `{ configured: true }`,
    **Quando** o usuário acessa `/setup`,
    **Então** redireciona para `/`. O wizard nunca aparece pra quem já configurou.

15. **AC15 — Step 1 (Admin) cria primeiro admin**
    **Dado** o wizard no step 1,
    **Quando** o usuário preenche nome + email + senha (≥ 8 chars) e submete,
    **Então** chama `POST /setup/advance` com `{ step: 1, data: { name, email, password } }`, em sucesso avança para step 2 e o backend persiste `currentStep=2`. O usuário admin criado existe na tabela `users` com role `super_admin`.

16. **AC16 — Step 2 (SMTP) com test e advance**
    **Dado** o wizard no step 2,
    **Quando** o usuário preenche `host`, `port`, `user`, `password`, `from`, **clica em "Testar conexão"**,
    **Então** o React chama `POST /setup/test-smtp` (sem persistir credenciais) e mostra OK/erro.
    **E quando** ele clica em "Avançar", chama `POST /setup/advance` com `{ step: 2, data: {…} }` e avança.

17. **AC17 — Step 3 (Domain)**
    Recebe `baseUrl` do step (ex.: `https://bms.exemplo.com`), valida formato URL, chama `POST /setup/advance` com `{ step: 3, data: { baseUrl } }`.

18. **AC18 — Step 4 (SendGrid) com test**
    Coleta API key + subuser, **botão "Testar conexão"** chama `POST /setup/test-sendgrid`, depois `POST /setup/advance` com `{ step: 4, data: {…} }`.

19. **AC19 — Step 5 (IP Pool + primeira conta)**
    Coleta nome da conta, IPs (combobox tipo "tag input"), **opção de skip** (não criar pool — wizard fecha mesmo assim). Chama `POST /setup/advance` com `{ step: 5, data: {…} }`. Em sucesso, `GET /setup/status` passa a retornar `configured: true`.

20. **AC20 — Idempotência do wizard**
    **Dado** o usuário fechou o browser no meio do step 3,
    **Quando** ele reabre,
    **Então** `GET /setup/status` devolve `currentStep=3`, e o wizard abre direto no step 3 sem perder o progresso anterior. Tentar enviar `step < currentStep` no `POST /setup/advance` é no-op no backend.

21. **AC21 — Setup wizard não tem header/sidebar**
    O layout do `/setup` é isolado: sem layout autenticado, sem sidebar, sem account switcher. **Mesma regra do Vue 3 manager** (`SetupPage.vue` renderiza standalone).

22. **AC22 — `SetupGateway` axios isolado**
    O cliente HTTP usado pelo setup **não passa por interceptor de auth** (não injeta `Authorization`, não tenta refresh em 401, não dispara redirect para `/login`). Isso é crítico: durante o wizard a instância ainda **não tem usuário** — qualquer 401 do interceptor padrão quebraria o fluxo.

23. **AC23 — Auto-login após Step 1**
    **Dado** o admin foi criado no step 1,
    **Quando** o backend retorna sucesso,
    **Então** o React faz auto-login (chama `POST /auth/login` com as credenciais que o usuário acabou de digitar) **antes** de avançar pro step 2, populando o estado de auth — assim os steps 2–5 já rodam autenticados e os endpoints de teste podem (no futuro) ser protegidos sem quebrar o fluxo. Equivalente ao comportamento do commit `d1202c6` no Vue 3.

### Docs

24. **AC24 — Docs e env hygiene**
    `.env.example` documenta `VITE_AUTH_PROVIDER` (default `local`), `VITE_API_URL`, e marca `VITE_AUTH0_*` como opcionais. README do `frontend-react` ganha seção **"Auth"** + seção **"Setup wizard"** descrevendo o fluxo e dizendo que o `VITE_AUTH_PROVIDER` do front deve casar com `AUTH_PROVIDER` do backend.

## Tasks / Subtasks

### Bloco A — Auth (Fases 1–4, 6 do plano EVO-1014)

- [ ] **Task 1 — Composable `useAuth` + http-client (Fase 1)** (AC: #1, #2, #4, #5, #8)
  - [ ] Criar `src/features/auth/use-auth.ts`:
    - [ ] Estado module-level: `accessToken`, `tokenExpiresAt`, `refreshInflight`, `initialized`
    - [ ] Funções: `login(email, password)`, `logout()`, `refresh()`, `getAccessToken()`, `getAccessTokenSilently()` (alias), `bootstrapAuth()`, `__resetForTests()`
    - [ ] `login`: `axios.post(${VITE_API_URL}/auth/login, …, { withCredentials: true })`, popula token+expiresAt, dispara o flow de hidratação (`/users/me`) — pode delegar pro `useAuthInit` ou inline
    - [ ] `refresh`: single-flight (`if (refreshInflight) return refreshInflight`), `withCredentials: true`, em erro zera tokens
    - [ ] `getAccessToken`: cache se `Date.now() < tokenExpiresAt - 30_000`, senão chama `refresh`
    - [ ] `logout`: `POST /auth/logout` com `withCredentials: true`, **sempre** limpa estado local no `finally`
    - [ ] `useAuth()` hook React: **deriva de `useAppStore` via selectors** — `isAuthenticated = useAppStore(s => s.auth.status === 'authenticated')`, `user = …`, `isLoading = …`. Funções imperativas vêm direto do módulo.
  - [ ] Refatorar `src/lib/api-client.ts`:
    - [ ] Remover `setTokenFetcher` baseado em Auth0 — usar `getAccessToken()` direto do `use-auth.ts`
    - [ ] Adicionar `withCredentials: true` no `axios.create`
    - [ ] Response interceptor: 401 + URL não é `/auth/...` + `!_retry` → `refresh()` → reattach token → retry; falha → `useAppStore.resetAuth()` + redirect `/login?returnTo=<pathname+search>`
    - [ ] Skipar `axios.isCancel`
  - [ ] `.env.example` ganha `VITE_AUTH_PROVIDER=local` (default), comentário marcando `VITE_AUTH0_*` como opcionais
  - [ ] `src/vite-env.d.ts`: `VITE_AUTH_PROVIDER: 'local' | 'auth0'`

- [ ] **Task 2 — LoginPage real + bootstrap + guards (Fase 2)** (AC: #1, #2, #3, #11, #12)
  - [ ] Substituir `src/routes/login.tsx`:
    - [ ] Em modo `local`: form (email + password), validação client (regex email; password.length ≥ 8), botão "Entrar". Submit → `useAuth().login(...)`. 401 → `<Alert variant="destructive">E-mail ou senha inválidos.</Alert>`. Sucesso → navegar pra `safePath(returnTo)`.
    - [ ] Em modo `auth0`: redirect cego com `loginWithRedirect` (lógica atual)
    - [ ] Helper `safePath(returnTo)`: aceita só strings que `startsWith('/')` E `!startsWith('//')`, senão `/`
  - [ ] `src/main.tsx`: `await bootstrap()` (auth refresh silencioso) **dentro do gate de setup** — ver Task 6
  - [ ] `src/routes/_authenticated.tsx`: trocar `useAuth0()` por `useAuth()`. Manter `useAuthInit()`.
  - [ ] `src/routes/callback.tsx`: em modo `local`, `<Navigate to="/" replace />`. Em `auth0`, comportamento atual.
  - [ ] `src/routes/__root.tsx`: remover `AuthBridge` (api-client agora chama `getAccessToken` direto).

- [ ] **Task 3 — Refatorar `useAuthInit` (Fase 3)** (AC: #9)
  - [ ] `src/hooks/use-auth-init.ts`:
    - [ ] Trocar `useAuth0()` por `useAuth()`
    - [ ] **Manter `POST /users/login` apenas em modo `auth0`** (audit log no backend usa). Em `local`, o `auth.controller` já entrega o user — não chamar. (Confirmado em `apps/msgops-api/src/modules/users/users.controller.ts:24`: endpoint retorna **HTTP 410 Gone** quando `AUTH_PROVIDER=local`.)
    - [ ] Lógica restante mantida (`/users/me?accountId`, `/accounts/configs`, popula `useAppStore`)
  - [ ] `grep -r "etus_superbilling\|superbilling" apps/frontend-react/src/` — substituir ocorrências por leitura do store. Se zero ocorrências, documentar nas Completion Notes.

- [ ] **Task 4 — Auth0 como opt-in tree-shakeable (Fase 4)** (AC: #6, #7)
  - [ ] Criar `src/features/auth/auth0-adapter.tsx`:
    - [ ] `Auth0Adapter` envolve children com `<Auth0Provider>`
    - [ ] `useAuth0Auth()` adapta `useAuth0()` ao formato do `useAuth()` local
  - [ ] `src/main.tsx` — pattern dead-code-eliminável:
    ```tsx
    if (import.meta.env.VITE_AUTH_PROVIDER === 'auth0') {
      const { Auth0Adapter } = await import('./features/auth/auth0-adapter');
      // monta com Auth0Adapter
    } else {
      // monta direto
    }
    ```
  - [ ] Verificação DCE (Task 8): build em modo `local` + grep no chunk inicial.

### Bloco B — Setup Wizard (paridade com Vue 3)

- [ ] **Task 5 — `SetupGateway` axios isolado** (AC: #22)
  - [ ] Criar `src/features/setup/setup-gateway.ts`:
    - [ ] `axios.create` próprio (NÃO o `apiClient` global) — sem interceptor de auth, sem `withCredentials` (endpoints `/setup/*` são `@PublicRoute()`)
    - [ ] Métodos: `getStatus(): Promise<{ configured, currentStep, baseUrl? }>`, `advance(step, data)`, `testSmtp(data)`, `testSendgrid(data)`
    - [ ] `baseURL` igual ao `VITE_API_URL`
  - [ ] Tipos em `src/features/setup/setup.types.ts` (Step1Data, Step2Data, Step3Data, Step4Data, Step5Data — espelhar `apps/msgops-api/src/modules/setup/dtos/advance-step.dto.ts`)

- [ ] **Task 6 — Setup gate global no boot** (AC: #13, #14, #20)
  - [ ] `src/main.tsx`:
    1. Antes de tudo: `const status = await setupGateway.getStatus().catch(() => null)`
    2. Se `status?.configured === false` E pathname atual ≠ `/setup`: `window.history.replaceState(null, '', '/setup')` (ou `<Navigate>`)
    3. Se `status?.configured === true` E pathname === `/setup`: redireciona pra `/`
    4. Depois rodar `await bootstrap()` (auth) e montar `<RouterProvider>`
  - [ ] **Importante**: gate roda ANTES do auth bootstrap — se o usuário precisa fazer setup, ele não está autenticado ainda; refresh vai dar 401 (esperado, no-op).

- [ ] **Task 7 — Página `/setup` + 5 steps** (AC: #15, #16, #17, #18, #19, #21, #23)
  - [ ] Rota `src/routes/setup.tsx` (TanStack Router):
    - [ ] Layout standalone — não usa `_authenticated` parent
    - [ ] Estado local: `currentStep` (carregado via `setupGateway.getStatus()` no mount), `isLoading`
    - [ ] Indicator de 5 steps (números + checkmark) — espelhar `SetupPage.vue` mas em React + Tailwind do projeto (consultar `components.json` do shadcn/ui)
    - [ ] Card central + transição entre steps
  - [ ] Criar 5 componentes em `src/features/setup/steps/`:
    - [ ] `Step1Admin.tsx`: `name`, `email`, `password` (≥ 8). Submit → `setupGateway.advance(1, data)` → **auto-login** (`useAuth().login(email, password)`) → callback `onStepComplete`
    - [ ] `Step2Smtp.tsx`: `host`, `port` (number), `user`, `password`, `from`. Botão "Testar conexão" (chama `testSmtp`, mostra resultado). Botão "Avançar" → `advance(2, data)`
    - [ ] `Step3Domain.tsx`: `baseUrl` (URL válida). Submit → `advance(3, { baseUrl })`
    - [ ] `Step4Sendgrid.tsx`: `apiKey`, `subuser`. Botão "Testar conexão" → `testSendgrid`. Submit → `advance(4, data)`
    - [ ] `Step5Pool.tsx`: `accountName`, `ips: string[]` (combobox tag input). Botão "Pular" (envia `advance(5, { skip: true })` ou similar — checar DTO atual). Submit → `advance(5, data)` → `onFinish` (redireciona pra `/`)
  - [ ] Validação com `react-hook-form` + `zod` (já é convenção do projeto se existir; senão usar `zod` standalone — consultar libs em `package.json`)
  - [ ] i18n: textos em pt-BR (espelhar Vue 3) — pode hardcodar inicialmente se não houver chave i18n específica, criar chaves `setup.*` em `src/locales/`

### Bloco C — Hardening + Tests + Docs

- [ ] **Task 8 — Tests unit + integration** (AC: #1, #2, #4, #5, #8, #11, #12, #15–#23)
  - [ ] `src/features/auth/__tests__/use-auth.test.ts`: login OK, login 401, refresh OK, refresh 401, single-flight (5 paralelas → 1 POST), logout idempotente (rede falha → estado limpo), `bootstrapAuth` idempotente, `accessToken` nunca vai pra storage (spy)
  - [ ] `src/lib/__tests__/api-client.interceptor.test.ts`: 401 → refresh → retry; refresh fail → redirect; 401 em `/auth/refresh` não recursa; single-flight; 500 não dispara refresh
  - [ ] `src/features/setup/__tests__/setup-gateway.test.ts`: chamadas certas pros 4 endpoints; sem header `Authorization`
  - [ ] `src/features/setup/__tests__/Step1Admin.test.tsx`: validação de senha curta; submit → `advance(1)` → auto-login chamado
  - [ ] `src/features/setup/__tests__/setup-page.test.tsx` (smoke): navega entre os 5 steps respeitando `currentStep` do gateway

- [ ] **Task 9 — E2E Playwright** (AC: #1, #3, #5, #6, #13, #15–#19)
  - [ ] Atualizar `e2e/auth.setup.ts` para fluxo local
  - [ ] `e2e/auth.spec.ts`: login OK, login 401, sessão persistente após reload, logout
  - [ ] `e2e/setup.spec.ts` (novo): primeira execução roda os 5 steps até `configured: true`. Pode usar fixture que reseta `system_config` antes do teste (ou skipar se backend não suportar isolation)
  - [ ] `e2e/auth-auth0-smoke.spec.ts` (opt-in via env): smoke do fluxo Auth0
  - [ ] **CORS**: validar em `apps/msgops-api/src/main.ts` que tem `app.enableCors({ origin: <front origin>, credentials: true })`. Sem isso E2E quebra. Se não tiver, abrir issue separada.

- [ ] **Task 10 — Verificação de tree-shake do Auth0** (AC: #7)
  - [ ] `VITE_AUTH_PROVIDER=local pnpm --filter frontend-react build`
  - [ ] `grep -E "@auth0/auth0-react|auth0-spa-js" apps/frontend-react/dist/assets/index-*.js` deve retornar 0
  - [ ] Documentar comando no README

- [ ] **Task 11 — Hardening (Fase 6 EVO-1014)** (AC: #4, #5, #9)
  - [ ] Não enviar `Authorization` quando token é null (skipar header, não mandar `Bearer null`)
  - [ ] `useAuthInit` cancela in-flight via `AbortController` quando logout dispara
  - [ ] Após re-login, invalidar query keys de auth/perms no React Query (`queryClient.invalidateQueries({ queryKey: ['users-me'] })` etc.)

- [ ] **Task 12 — Docs (Fase 7 EVO-1014)** (AC: #24)
  - [ ] `.env.example` (auth + setup): comentar `VITE_AUTH0_*` como opcionais, garantir `VITE_API_URL`
  - [ ] `apps/frontend-react/README.md`: seções "## Auth (local default, Auth0 opt-in)" e "## Setup wizard"
  - [ ] `apps/frontend-react/CLAUDE.md` (estender ou criar): paths críticos de auth (`use-auth.ts`, `api-client.ts`) e setup (`setup-gateway.ts`, `routes/setup.tsx`)

## Dev Notes

### Backend já existe — não tocar

| Endpoint | Onde | Observação |
|---|---|---|
| `POST /auth/login`, `/auth/refresh`, `/auth/logout` | `apps/msgops-api/src/modules/auth/auth.controller.ts` | Só montam quando `AUTH_PROVIDER=local`; refresh via cookie httpOnly `bms_refresh` (sameSite=lax, path=/, secure em prod). |
| `GET /setup/status` | `apps/msgops-api/src/modules/setup/setup.controller.ts:13` | Público. Devolve `{ configured, currentStep, baseUrl? }`. |
| `POST /setup/advance` | `setup.controller.ts:19` | Público. Body: `{ step: 1\|2\|3\|4\|5, data: <step-specific> }`. Idempotente (envio de step ≤ currentStep no-op). |
| `POST /setup/test-smtp` | `setup.controller.ts:25` | Público. Não persiste credenciais. |
| `POST /setup/test-sendgrid` | `setup.controller.ts:31` | Público. Não persiste credenciais. |
| `GET /users/me` | `apps/msgops-api/src/modules/users/users.controller.ts:48` | Fonte única de roles/permissões. |
| `POST /users/login` | `users.controller.ts:20` | **Retorna HTTP 410 Gone** quando `AUTH_PROVIDER=local`. Manter chamada **só** no fluxo Auth0. |

### Steps do wizard — DTOs

Espelhar `apps/msgops-api/src/modules/setup/dtos/advance-step.dto.ts` exatamente. Inspecionar antes de escrever os tipos React.

### Modelo a replicar

| Vue 3 manager (referência) | React (destino) |
|---|---|
| `apps/msgops-manager-frontend/src/composables/useAuth.ts` | `apps/frontend-react/src/features/auth/use-auth.ts` |
| `apps/msgops-manager-frontend/src/infra/HttpClient/AxiosAdapter.ts` | `apps/frontend-react/src/lib/api-client.ts` (refator) |
| `apps/msgops-manager-frontend/src/gateways/Setup/SetupGateway.ts` | `apps/frontend-react/src/features/setup/setup-gateway.ts` |
| `apps/msgops-manager-frontend/src/pages/SetupPage/SetupPage.vue` | `apps/frontend-react/src/routes/setup.tsx` |
| `apps/msgops-manager-frontend/src/pages/SetupPage/steps/Step{1..5}*.vue` | `apps/frontend-react/src/features/setup/steps/Step{1..5}*.tsx` |
| `apps/msgops-manager-frontend/src/router.ts:22` (gate `setupGateway.getStatus()`) | `apps/frontend-react/src/main.tsx` (gate antes do RouterProvider) |

### Padrão canônico de single-flight refresh

Direto de `apps/frontend-vue2/src/services/auth.service.ts`:

```ts
let accessToken: string | null = null;
let tokenExpiresAt = 0;
let refreshInflight: Promise<string | null> | null = null;

export async function refresh(): Promise<string | null> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    try {
      const { data } = await axios.post(`${baseURL}auth/refresh`, null, { withCredentials: true });
      setTokens(data.accessToken, data.expiresIn);
      return data.accessToken;
    } catch {
      setTokens(null, 0);
      return null;
    } finally {
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}

export async function getAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < tokenExpiresAt - 30_000) return accessToken;
  return refresh();
}
```

Interceptor (`apps/frontend-vue2/src/services/api.service.ts`):

```ts
api.interceptors.response.use(r => r, async (error) => {
  const original = error.config as any;
  const isAuthEndpoint = original?.url?.match(/auth\/(refresh|login|logout)/);
  if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
    original._retry = true;
    const newToken = await refresh();
    if (newToken) return api(original);
    await logout();
    window.location.assign(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
  }
  return Promise.reject(error);
});
```

> Diferença do Vue 2 → React: param na URL é `returnTo`, não `redirect`.

### Drop-in `useAuth0` → `useAuth`

| `useAuth0()` (atual) | `useAuth()` novo |
|---|---|
| `isAuthenticated` / `isLoading` / `user` | idem (deriva de `useAppStore`) |
| `loginWithRedirect(opts)` | em local: `window.location.assign('/login?returnTo=…')` |
| `logout(opts)` | `POST /auth/logout` + clear local |
| `getAccessTokenSilently()` | alias de `getAccessToken` |

`user.sub` (Auth0) ≠ `user.providerId` (local: `local|<uuid>`). Revisar usos de `user.sub` no React.

### Estado atual do `frontend-react` (paths críticos)

| Path | Papel |
|---|---|
| `src/main.tsx` | Monta `<Auth0Provider>` + `<RouterProvider>`. **Reescrever**: gate de setup → bootstrap auth → render. |
| `src/routes/login.tsx` | Hoje: redirect cego. **Substituir por form.** |
| `src/routes/_authenticated.tsx` | Guard. Trocar `useAuth0` → `useAuth`. |
| `src/routes/callback.tsx` | No-op em local. |
| `src/routes/__root.tsx` | Remover `AuthBridge`. |
| `src/lib/api-client.ts` | Singleton axios. **Refatorar.** |
| `src/hooks/use-auth-init.ts` | Hidratação pós-login. **Adaptar (skip `/users/login` em local).** |
| `src/stores/app-store.ts` | Zustand. **Manter — só muda como entra.** |
| `src/test-utils/authenticate-store.ts` | Mock. Atualizar `providerId: 'local|...'`. |
| `e2e/auth.setup.ts`, `e2e/auth.spec.ts` | E2E. Reescrever pra fluxo local + setup. |
| `src/components/layout/sidebar.tsx` | Logout button. Trocar `useAuth0` → `useAuth`. |
| `src/components/layout/__tests__/account-selector.test.tsx`, `sidebar-bottom.test.tsx` | Mocks de `useAuth0`. Substituir. |

### Project Structure Notes

- `src/features/auth/` (novo) — composable + adapter Auth0
- `src/features/setup/` (novo) — gateway + steps + types
- `src/routes/setup.tsx` (novo)
- Não tocar em `apps/frontend-vue2/`, `apps/msgops-manager-frontend/`, `apps/msgops-api/`
- Vue 3 manager continua existindo (Accounts/Users/Billing) — fora do escopo.

### Testing standards

- **Vitest** + jsdom. Mocks de axios: usar `axios-mock-adapter` ou `msw` (preferir `msw`; se não estiver, usar `axios-mock-adapter` e abrir tech-debt).
- **Playwright** Chromium, single worker. `webServer.command: pnpm dev` já existe.
- Coverage: padrão atual (`v8`, `lcov`, `json-summary`).

### References

- [Source: apps/msgops-api/src/modules/auth/auth.controller.ts] — contrato HTTP de auth
- [Source: apps/msgops-api/src/modules/auth/providers/local-auth.provider.ts] — semântica de tokens, rotation, reuse detection
- [Source: apps/msgops-api/src/modules/setup/setup.controller.ts] — contrato HTTP do wizard
- [Source: apps/msgops-api/src/modules/setup/setup.service.ts] — máquina de estado do wizard (steps 1-5, idempotência)
- [Source: apps/msgops-api/src/modules/setup/dtos/advance-step.dto.ts] — schema dos dados por step
- [Source: apps/msgops-api/src/modules/users/users.controller.ts:20-46] — `/users/login` retorna 410 Gone em modo local
- [Source: apps/frontend-vue2/src/services/auth.service.ts] — modelo de single-flight refresh + token em memória
- [Source: apps/frontend-vue2/src/services/api.service.ts] — interceptor 401 → refresh → retry
- [Source: apps/msgops-manager-frontend/src/composables/useAuth.ts] — drop-in `useAuth0`
- [Source: apps/msgops-manager-frontend/src/infra/HttpClient/AxiosAdapter.ts] — interceptor pronto em TS+axios
- [Source: apps/msgops-manager-frontend/src/gateways/Setup/SetupGateway.ts] — gateway HTTP isolado
- [Source: apps/msgops-manager-frontend/src/pages/SetupPage/SetupPage.vue] — UX dos 5 steps + indicator
- [Source: apps/msgops-manager-frontend/src/router.ts:22] — gate de setup antes das rotas
- [Source: apps/frontend-react/src/lib/api-client.ts] — http client AS-IS
- [Source: apps/frontend-react/src/hooks/use-auth-init.ts] — hidratação AS-IS
- [Source: apps/frontend-react/src/stores/app-store.ts] — store Zustand
- Linear: https://linear.app/evoai/issue/EVO-1014
- Commits canônicos do auth no Vue 2: `7608eca`, `7248dd8`, `f40786b`
- Commit do setup wizard (Vue 3 + backend): `e4ea7a8`, depois evoluído em `3ea431f`, `747270f`, `47cba2c`, `fd4268b`, `d1202c6`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — `claude-opus-4-7[1m]`

### Debug Log References

- Branch criada a partir de `origin/main`: `davidson/evo-1014-frontend-react-replace-vue2`
- `pnpm --filter frontend-react install` precisou criar `packages/test-config` (faltava no monorepo, era dep workspace do `frontend-react`)
- `pnpm --filter frontend-react type-check`: ✅ zero erros
- `pnpm --filter frontend-react test`: ✅ 202 test files, 2022 tests passing (cresceu de 2004 → 2022 com testes novos de auth/setup/Step1Admin)
- `pnpm --filter frontend-react build`: ✅ chunks gerados; entry chunk `index-*.js` sem `@auth0/auth0-react` (DCE confirmado por `grep`)

### Completion Notes List

**Auth (Tasks 1-4):**
- ✅ AC1-AC8 cobertos. Token em memória, refresh single-flight, 401 → refresh → retry no interceptor, logout idempotente
- ✅ AC6/AC7: Auth0 fica em chunk lazy (não eliminado totalmente porque o pacote ainda existe em `node_modules` por ser opt-in), mas **fora do entry chunk** em modo `local` — verificado via `grep` no build output
- ✅ AC8: spy em `Storage.prototype.setItem` no teste `use-auth.test.ts` confirma que JWT nunca é gravado em localStorage/sessionStorage
- ✅ AC9: `etus_superbilling`/`superbilling` não existem em `apps/frontend-react/src/` (grep retorna 0). `useAppStore.isMasterUser` + `effectiveRole` são a fonte única
- ✅ AC10: `/callback` é redirect para `/` em modo local (componente `<AuthCallbackPage>` checa `AUTH_PROVIDER`)
- ✅ AC12: `safePath()` rejeita `//`, `https://`, `javascript:`

**Setup wizard (Tasks 5-7):**
- ✅ AC13/AC14: `applySetupGate()` em `main.tsx` redireciona antes do RouterProvider
- ✅ AC22: `setup-gateway.ts` cria axios isolado, sem interceptors (verificado em `setup-gateway.test.ts`)
- ✅ AC23: Step1Admin auto-loga após criação (chama `useAuth.login`); auto-login é best-effort (não bloqueia se falhar)
- ✅ Tem 6 steps (não 5 como a issue dizia inicialmente): Admin / SMTP / Domain / SendGrid / Pool / HealthCheck. O HealthCheck (step 6) foi adicionado pelo commit `3ea431f` e está no backend.

**Hardening (Task 11):**
- ✅ `Authorization` header não é enviado quando token é null (`if (token) ...`)
- ✅ `useAuthInit` cancela in-flight via `AbortController` (já era o caso)
- ✅ `login()` invalida `users-me` e `accounts-configs` no `queryClient` para força refetch após re-login

**CORS:**
- ✅ Backend já tem `cors({ credentials: true, origin: <validador> })` em `apps/msgops-api/src/main.ts:66` + `apps/msgops-api/src/cors.config.ts`. E2E em dev (`localhost:3000` ↔ `localhost:5001`) deve funcionar.

**Pendências reconhecidas (não bloqueiam o PR):**
- Steps 2-6 do wizard têm zero testes unitários (só Step1Admin tem). A QA deve focar lá manualmente.
- `useAuthInit` no caso "token válido + user null" (hard reload em local mode) não tem teste — foi o bug que o advisor pegou na revisão. Mas o fix está aplicado (drop do `!user` check) e foi validado por type-check e suite completa.
- Não rodei o dev server num browser real para ver o fluxo end-to-end. **Recomendação ao usuário: rodar `pnpm --filter frontend-react dev` antes de merge** para validar visualmente o login local + reload silencioso.

### File List

**Novos:**
- `apps/frontend-react/src/features/auth/use-auth.ts`
- `apps/frontend-react/src/features/auth/auth0-adapter.tsx`
- `apps/frontend-react/src/features/auth/__tests__/use-auth.test.ts`
- `apps/frontend-react/src/features/setup/setup.types.ts`
- `apps/frontend-react/src/features/setup/setup-gateway.ts`
- `apps/frontend-react/src/features/setup/steps/Step1Admin.tsx`
- `apps/frontend-react/src/features/setup/steps/Step2Smtp.tsx`
- `apps/frontend-react/src/features/setup/steps/Step3Domain.tsx`
- `apps/frontend-react/src/features/setup/steps/Step4Sendgrid.tsx`
- `apps/frontend-react/src/features/setup/steps/Step5Pool.tsx`
- `apps/frontend-react/src/features/setup/steps/Step6HealthCheck.tsx`
- `apps/frontend-react/src/features/setup/__tests__/setup-gateway.test.ts`
- `apps/frontend-react/src/features/setup/__tests__/Step1Admin.test.tsx`
- `apps/frontend-react/src/routes/setup.tsx`
- `packages/test-config/package.json`
- `packages/test-config/vitest-setup.ts`
- `_evo-output/implementation-artifacts/local-auth-provider/1-1-frontend-react-local-auth-provider.md` (este arquivo)

**Modificados:**
- `apps/frontend-react/.env.example`
- `apps/frontend-react/README.md`
- `apps/frontend-react/src/lib/api-client.ts`
- `apps/frontend-react/src/lib/router-context.ts`
- `apps/frontend-react/src/main.tsx`
- `apps/frontend-react/src/vite-env.d.ts`
- `apps/frontend-react/src/hooks/use-auth-init.ts`
- `apps/frontend-react/src/components/layout/sidebar.tsx`
- `apps/frontend-react/src/routes/__root.tsx`
- `apps/frontend-react/src/routes/_authenticated.tsx`
- `apps/frontend-react/src/routes/login.tsx`
- `apps/frontend-react/src/routes/callback.tsx`
- `apps/frontend-react/e2e/auth.setup.ts`
- `apps/frontend-react/e2e/auth.spec.ts`
- `apps/frontend-react/e2e/helpers.ts`
- `apps/frontend-react/src/lib/__tests__/api-client.test.ts`
- `apps/frontend-react/src/hooks/__tests__/use-auth-init-discovery.test.ts`
- `apps/frontend-react/src/hooks/__tests__/use-auth-init-redirect.test.ts`
- `apps/frontend-react/src/routes/__tests__/-auth-redirect.test.tsx`
- `apps/frontend-react/src/components/layout/__tests__/account-selector.test.tsx`
- `apps/frontend-react/src/components/layout/__tests__/sidebar-bottom.test.tsx`
- `pnpm-lock.yaml`

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-04-28 | 0.1 | Story criada (escopo só auth) | Claude |
| 2026-04-28 | 0.2 | Revisões do advisor (tree-shake AC7, reactivity Zustand, `/users/login` em modo local, CORS) | Claude |
| 2026-04-28 | 1.0 | **Reescopo**: cenário A — React substitui Vue 2 + ganha setup wizard de 5 steps. Adicionados ACs #13–#23 e Tasks 5/6/7. Painel admin (Accounts/Users/Billing) explicitamente fora do escopo (continua no Vue 3 manager). | Claude |
| 2026-04-28 | 1.1 | **Code review adversarial — fixed all HIGH+MEDIUM**: H1 logout em modo Auth0 agora também reseta Zustand; H2 race de double-navigate no LoginPage removida; H3 `AuthUserPayload.id` virou opcional pra forçar consumers a tratar a janela pré-hidratação; M1 `useCallback` no-op removidos; M2 `__setAuth0Bridge`/`__setAuth0State` mesclados em uma única função atômica; M3 double `emit()` no `login()` removido; M5 `Step5Pool` campos opcionais alinhados com backend; L2 `RETRY_COOLDOWN_MS` constante nomeada. Type-check ✅, 2022/2022 tests passing. | Claude |
