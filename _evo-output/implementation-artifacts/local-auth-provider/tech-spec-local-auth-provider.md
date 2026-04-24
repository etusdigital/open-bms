---
title: 'Substituição Auth0 por Autenticação Local Plugável'
slug: 'local-auth-provider'
created: '2026-04-23'
status: 'done'
stepsCompleted: [1, 2, 3, 4, 5]
reviewed: '2026-04-24'
tech_stack:
  - 'NestJS 10+ (msgops-api)'
  - 'TypeORM + PostgreSQL'
  - 'Vue 2 + Vuex (frontend-vue2)'
  - 'Vue 3 + Pinia (msgops-manager-frontend)'
  - 'passport-jwt + jwks-rsa (atual, preservado para Auth0AuthProvider)'
  - 'jsonwebtoken (já em deps; usado em AuthzService.verifyJwtToken)'
  - 'bcrypt (NOVA dep — confirmado ausente em apps/msgops-api/package.json)'
  - 'uuid (NOVA dep — confirmado ausente em apps/msgops-api/package.json)'
  - 'cookie-parser (JÁ instalado: package.json:50 e wired em main.ts:6,47 — NÃO re-adicionar)'
  - 'CLS (nestjs-cls) para contexto por request'
files_to_modify:
  # Backend (apps/msgops-api)
  - 'apps/msgops-api/src/auth/jwt.strategy.ts (DELETE — dead code: zero @UseGuards(AuthGuard("jwt")) em todo o repo)'
  - 'apps/msgops-api/src/auth/auth.module.ts (DELETE — só exporta JwtStrategy; morto junto)'
  - 'apps/msgops-api/src/cors.config.ts (habilitar credentials: true + rejeitar origin null em prod)'
  - 'apps/msgops-api/src/modules/authz/authz.service.ts'
  - 'apps/msgops-api/src/modules/users/users.service.ts'
  - 'apps/msgops-api/src/modules/users/users.controller.ts'
  - 'apps/msgops-api/src/modules/users/users.module.ts'
  - 'apps/msgops-api/src/providers/auth0.provider.ts'
  - 'apps/msgops-api/src/main.ts'
  - 'apps/msgops-api/src/app.module.ts'
  - 'apps/msgops-api/package.json'
  - 'apps/msgops-api/.env.example'
  # Novos no backend
  - 'apps/msgops-api/src/modules/auth/auth.module.ts (NOVO)'
  - 'apps/msgops-api/src/modules/auth/auth.controller.ts (NOVO)'
  - 'apps/msgops-api/src/modules/auth/auth.service.ts (NOVO)'
  - 'apps/msgops-api/src/modules/auth/dto/login.dto.ts (NOVO)'
  - 'apps/msgops-api/src/modules/auth/providers/auth.provider.interface.ts (NOVO)'
  - 'apps/msgops-api/src/modules/auth/providers/local-auth.provider.ts (NOVO)'
  - 'apps/msgops-api/src/modules/auth/providers/auth0-auth.provider.ts (NOVO - movido/refatorado de src/providers/auth0.provider.ts)'
  - 'apps/msgops-api/src/entities/user-credentials.entity.ts (NOVO)'
  - 'apps/msgops-api/src/entities/user-refresh-token.entity.ts (NOVO)'
  - 'apps/msgops-api/src/migrations/<ts>-create-user-credentials.ts (NOVO)'
  - 'apps/msgops-api/src/migrations/<ts>-create-user-refresh-tokens.ts (NOVO)'
  - 'apps/msgops-api/src/bootstrap/seed-admin.ts (NOVO)'
  # Frontend Vue2 (apps/frontend-vue2)
  - 'apps/frontend-vue2/src/auth/VueAuth.ts (REMOVER)'
  - 'apps/frontend-vue2/src/auth/auth.ts (REMOVER plugin Auth0, manter se virar wrapper local)'
  - 'apps/frontend-vue2/src/auth/User.ts'
  - 'apps/frontend-vue2/src/auth/guards/auth.guard.ts'
  - 'apps/frontend-vue2/src/services/auth.service.ts'
  - 'apps/frontend-vue2/src/services/api.service.ts'
  - 'apps/frontend-vue2/src/main.ts'
  - 'apps/frontend-vue2/src/router.ts (ADICIONAR /login)'
  - 'apps/frontend-vue2/src/pages/login/LoginPage.vue (NOVO)'
  - 'apps/frontend-vue2/package.json'
  - 'apps/frontend-vue2/.env.example'
  # Frontend Vue3 (apps/msgops-manager-frontend)
  - 'apps/msgops-manager-frontend/src/infra/Auth/Auth.ts (REMOVER ou refatorar p/ local)'
  - 'apps/msgops-manager-frontend/src/composables/useAuth.ts (NOVO - drop-in de useAuth0)'
  - 'apps/msgops-manager-frontend/src/main.ts'
  - 'apps/msgops-manager-frontend/src/App.vue'
  - 'apps/msgops-manager-frontend/src/router.ts'
  - 'apps/msgops-manager-frontend/src/components/BmsHeader.vue'
  - 'apps/msgops-manager-frontend/src/components/BmsSidebar/BmsSidebar.vue (auditar hideFromRoles contra role codes reais do DB)'
  - 'apps/msgops-manager-frontend/src/pages/Billing/BillingPage/BillingPage.vue (linha 167: trocar roles.includes(etus_superbilling) por effectiveRole==billing OR permission específica)'
  - 'apps/msgops-manager-frontend/src/stores/Users/useUserStore.ts'
  - 'apps/msgops-manager-frontend/src/pages/Login/LoginPage.vue (NOVO)'
  - 'apps/msgops-manager-frontend/src/pages/Users/UsersPage/index.ts (substituir authGuard)'
  - 'apps/msgops-manager-frontend/src/pages/Billing/BillingPage/index.ts (idem)'
  - 'apps/msgops-manager-frontend/src/pages/Accounts/AccountsPage/index.ts (idem)'
  - 'apps/msgops-manager-frontend/src/pages/Accounts/AccountCreatePage/index.ts (idem)'
  - 'apps/msgops-manager-frontend/src/pages/Accounts/AccountEditPage/index.ts (idem)'
  - 'apps/msgops-manager-frontend/src/pages/Users/UserCreatePage/index.ts (idem)'
  - 'apps/msgops-manager-frontend/src/pages/Users/UserEditPage/index.ts (idem)'
  - 'apps/msgops-manager-frontend/package.json'
  - 'apps/msgops-manager-frontend/.env.example'
  - 'apps/msgops-manager-frontend/README.md'
  # Docs raiz
  - 'CLAUDE.md'
  - 'README.md'
code_patterns:
  - 'DI NestJS: @Injectable() + constructor injection. Provider token string (ex: AUTH_PROVIDER) para seleção runtime via useFactory.'
  - 'TypeORM: entidades em apps/msgops-api/src/entities/*.entity.ts, snake_case em DB, camelCase em classes.'
  - 'Migrations: apps/msgops-api/src/migrations/<timestamp>-<desc>.ts; classe com up()/down(). Roles sistêmicos seedados via migration 1771800000000-create-rbac-core.ts.'
  - 'Guards globais: APP_GUARD em app.module.ts (PrincipalContextGuard + PermissionGuard).'
  - 'Request context: nestjs-cls (ClsService) propaga userId/accountId/permissions por request.'
  - 'JWT atual: passport-jwt validation com passportJwtSecret + jwksUri; alg RS256; audience/issuer validados.'
  - 'Redis cache: AuthzService cacheia PrincipalContext por 5 min via chave `authz:user:${providerId}:${accountId || "default"}` (authz.service.ts:117). Invalidação via `invalidateUserCache(providerId)`.'
  - 'Vue2: plugin Vue.use(), injeção via Vue.prototype.$auth. Guards como beforeEnter nas rotas. Vuex store.'
  - 'Vue3: app.use() para plugins. Composables com useXxx(). Pinia stores em src/stores/<Domain>/useXxxStore.ts.'
  - 'Axios interceptor: anexa Authorization Bearer via função getAccessToken() do provider de auth.'
test_patterns:
  - 'Backend: Jest unit tests com mocks via jest.Mocked. Exemplo: src/modules/authz/permission.guard.spec.ts (93 linhas, mocka AuthzService).'
  - 'Backend E2E: tests/e2e/jest-e2e.json, supertest.'
  - 'Frontend Vue2: Jest via @vue/cli-service.'
  - 'Frontend Vue3: Vitest.'
  - 'Nenhum teste atual mocka Auth0 diretamente — tokens Auth0 não aparecem em fixtures.'
---

# Tech-Spec: Substituição Auth0 por Autenticação Local Plugável

**Created:** 2026-04-23

## Overview

### Problem Statement

A dependência de Auth0 bloqueia ambientes de desenvolvimento (Danilo não consegue subir o ambiente local; risco de o mesmo acontecer em outros setups) e é uma barreira inaceitável para adopters da versão open-source v0.1.0 (hard deadline 2026-05-26). Um self-hoster do BMS não deve precisar de tenant Auth0 para rodar a plataforma. Ao mesmo tempo, deployments que já usam Auth0 (ex.: SaaS operado pela EvolutionAPI) precisam poder continuar usando Auth0 sem reescrita.

### Solution

Introduzir interface `IAuthProvider` no backend NestJS (`msgops-api`) com duas implementações intercambiáveis:

- **`LocalAuthProvider`** (default OSS): emite JWT HS256 assinado com `JWT_SECRET`, valida senha com bcrypt 12 rounds, refresh token opaco (UUID) persistido em DB e entregue em cookie httpOnly.
- **`Auth0AuthProvider`**: preserva o comportamento atual (JWKS + Management Client), selecionado via `AUTH_PROVIDER=auth0`.

Seleção via env `AUTH_PROVIDER=local|auth0` (default `local`).

Nos frontends `frontend-vue2` e `msgops-manager-frontend`, substituir os SDKs Auth0 por composable/serviço próprio que mantém a mesma interface superficial usada pelo app hoje (`loginWithRedirect`, `logout`, `user`, `isAuthenticated`, `getAccessToken`), implementado contra a API local. Tela de login própria em cada frontend substitui o Universal Login do Auth0.

Eliminar o custom roles claim namespaced no JWT: frontends passam a ler roles e permissões via `GET /users/me` (endpoint já existente que retorna o `PrincipalContext`).

Bootstrap do admin inicial: no boot do `msgops-api`, se tabela `users` estiver vazia, criar admin a partir de envs `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD` (idempotente, roda apenas quando DB vazia).

### Scope

**In Scope:**

- Backend (`apps/msgops-api`):
  - Nova interface `IAuthProvider` e providers `LocalAuthProvider` + `Auth0AuthProvider`.
  - Seleção via env `AUTH_PROVIDER=local|auth0` (default `local`).
  - Novos endpoints `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` — **`AuthController` registrado condicionalmente** apenas quando `AUTH_PROVIDER=local`.
  - Bcrypt 12 rounds para hash de senha.
  - JWT HS256 via `JWT_SECRET`, claims compatíveis com o shape atual (`sub`, `aud`, `iss`, `email`, `name`, `picture`, `email_verified`).
  - Refresh token opaco (UUID) em cookie httpOnly, persistido em `user_refresh_tokens` (hash armazenado, não o valor claro). **Cookie `Path=/`** para funcionar atrás de reverse proxy com prefixo.
  - Migrations Postgres: `user_credentials`, `user_refresh_tokens`.
  - Substituição das chamadas ao `Auth0Provider` (Management Client) em `users.service.ts` por chamadas genéricas ao `IAuthProvider`.
  - Bootstrap admin no boot quando `users` vazia, com **advisory lock** para evitar race multi-réplica.
  - `AuthzService.verifyJwtToken` delega para `IAuthProvider.verifyToken`.
  - **DELETE de `src/auth/jwt.strategy.ts` e `src/auth/auth.module.ts`** — são dead code (grep confirmou zero referências a `AuthGuard('jwt')` no repo).
  - `POST /users/login` legado retorna **410 Gone** em modo `local`; permanece funcional em modo `auth0`.
  - **CORS: habilitar `credentials: true`** em `src/cors.config.ts:35-44` + rejeitar origin vazia em produção (bloqueador real, agora in scope).
  - `AuthzService.invalidateUserCache(providerId)` disparado em logout e em `updatePassword` (evita que sessão continue cached no Redis por 5 min após logout).
  - `LocalAuthProvider.updatePassword` rejeita providerIds que não começam com `local|` (evita corromper users legados em modo híbrido).
- Frontend Vue 2 (`apps/frontend-vue2`):
  - Remover `@auth0/auth0-spa-js`.
  - Plugin `authPlugin` com superfície compatível com o atual (`this.$auth.{login,logout,getAccessToken,user,isAuthenticated}`).
  - Tela de login própria.
  - Guard de rota adaptado para redirecionar a `/login`.
  - `ApiService.getApi()` refatorada para **axios instance singleton** com interceptor 401→refresh→retry registrado 1x (implementação atual cria instance nova por chamada — incompatível com interceptor-based refresh).
  - Access token armazenado **apenas em memória** (sem `sessionStorage`). Hard reload dispara `/auth/refresh` silencioso usando cookie httpOnly.
  - **Sem mudanças de leitura de roles no Vue2** — grep confirmou que `VUE_APP_AUTH0_ROLES_CLAIM` não é lido por código fonte hoje. Apenas remover as envs do `.env.example`.
- Frontend Vue 3 (`apps/msgops-manager-frontend`):
  - Remover `@auth0/auth0-vue`.
  - Composable `useAuth` drop-in com `isAuthenticated`, `user`, `logout`, `loginWithRedirect` (redireciona para `/login` local).
  - Tela de login em `/login` substitui o redirect para Auth0; `/callback` removida.
  - `authGuard` novo local em `src/router/guards/authGuard.ts`.
  - Leitura de roles migra para `GET /users/me` — `userStore.roles` passa a conter **apenas códigos reais do DB** (`super_admin`, `admin`, `editor`, `analyst`, `support`, `billing`).
  - **Refactor de dois usos de role hardcoded:**
    - `router.ts:11-12,25-28`: eliminar `ROLES_CLAIM` e `BILLING_ONLY_ROLE`. Redirect de `/users` e `/accounts` para `/billing` passa a usar `userStore.effectiveRole === 'billing'` (ou permission check equivalente).
    - `BillingPage/BillingPage.vue:167`: `userStore.roles.includes('etus_superbilling')` → `userStore.isSuperAdmin || userStore.effectiveRole === 'billing'` (ou flag explícita no `/users/me` response como `canSeeAllAccounts: boolean`).
  - `BmsSidebar.vue:27`: auditar `hideFromRoles` dos itens do menu contra a nova base de role codes (DB).
- Docs e envs:
  - Reescrita de `CLAUDE.md` (raiz), `README.md` (raiz), `apps/msgops-manager-frontend/README.md`.
  - Atualização dos 3 `.env.example` (remove AUTH0*\*, adiciona JWT*_, AUTH*PROVIDER, BOOTSTRAP_ADMIN*_).

**Out of Scope:**

- Signup self-service (permanece admin-invite via `POST /users/invite`).
- Forgot password por email (reset continua via `PUT /users/update-password/:id` por admin).
- MFA, login social (Google, GitHub), SSO.
- Rate limiting / account lockout após N tentativas (abrir issue separada).
- Correção de inconsistências RBAC preexistentes além da eliminação do custom roles claim.
- Migração de usuários Auth0 existentes → usuários locais (deployments que trocarem provider farão via reinvite; não entra em scripts automatizados de migração nesta V0.1).
- Detecção avançada de refresh token reuso (revogar família inteira). V0.1 apenas rejeita + loga estruturado para visibilidade operacional.
- TTL cleanup automático de `user_refresh_tokens` expirados/revogados. Cron job pós-V0.1.
- Tela de "billing-only viewer" customizada (role Auth0 `superbilling` legada) — não é o mesmo que role `billing` do DB; se adopter precisar, entra em v0.2.

## Context for Development

### Codebase Patterns

**Backend (`apps/msgops-api`):**

- NestJS com módulos por domínio (`modules/authz`, `modules/users`, etc.). Guards globais registrados via `APP_GUARD` em `app.module.ts`: `PrincipalContextGuard` (resolve user/api-key → `request.authzContext` + CLS) seguido de `PermissionGuard` (verifica `@RequirePermission` e `@RequireSuperAdmin`).
- JWT validation **efetivamente única hoje**: `AuthzService.verifyJwtToken` (`src/modules/authz/authz.service.ts:~96-108`, método `private`) usa `jsonwebtoken` + `jwks-rsa` manualmente com cache de 10 chaves por 600s. `JwtStrategy` em `src/auth/jwt.strategy.ts` existe mas é **dead code** — `grep -rn "AuthGuard('jwt')\|@UseGuards(AuthGuard" apps/msgops-api/src/` retorna zero referências. Strategy + `src/auth/auth.module.ts` entram no escopo de deleção.
- TypeORM: entities em `src/entities/*.entity.ts`. Colunas snake_case no DB, camelCase em TS. Migrations em `src/migrations/<timestamp>-<desc>.ts`. RBAC já seedado via migration `1771800000000-create-rbac-core.ts` (6 roles sistêmicos + 72 permission keys).
- Decoradores de auth: `@RequirePermission('key')`, `@RequireSuperAdmin()`, `@PublicRoute()`, `@CronRoute()`.
- Cache Redis no `AuthzService` (`PrincipalContext` por 5 min, chave derivada do `providerId` + `accountId`).
- Auth0 Management Client (`src/providers/auth0.provider.ts`) injetado em `UsersService` (`src/modules/users/users.service.ts`) para CRUD de usuário/senha; 7 pontos de uso.

**Frontend Vue 2 (`apps/frontend-vue2`):**

- Plugin `auth0Plugin` registrado em `src/main.ts` (~linhas 159-166) via `Vue.use(auth0Plugin, { ... })`. Acessível como `this.$auth`.
- Classe `VueAuth` (`src/auth/VueAuth.ts`) encapsula o SDK `@auth0/auth0-spa-js`.
- `AuthService` (`src/services/auth.service.ts`) expõe `getAccessToken`, `login`, `logout`, `getUser`.
- `ApiService.getApi()` (`src/services/api.service.ts:28-43`) anexa `Authorization: Bearer <token>` + header custom `Current-User: JSON.stringify({name,email})`.
- Guard de rota (`src/auth/guards/auth.guard.ts:1-20`) — verifica `authService.getUser()` e dispara `login()` se não autenticado. (Vue2 router.ts NÃO tem `beforeEach` global de auth — guards são per-route.)
- **Roles no Vue2 não são lidos do custom claim** — grep em `apps/frontend-vue2/src/` confirma zero referências a `VUE_APP_AUTH0_ROLES_CLAIM` ou `ROLES_CLAIM` no código fonte (apenas `.env.example` cita a env). Qualquer controle de visibilidade por role hoje vem via API (endpoints retornam 403 quando role insuficiente). Logo, a "eliminação do claim" no Vue2 é limpeza de env somente — sem mudança de código.
- **Axios instance por chamada:** `ApiService.getApi()` (src/services/api.service.ts:28-43) cria uma **nova** instância a cada chamada, baking token e header `Current-User` no momento da construção. Interceptor 401→refresh precisa ser registrado na instance; implementação ingênua (`axios(error.config)` bare) não repassa interceptors nem re-anexa headers. Refactor para singleton instance com interceptors registrados 1x.

**Frontend Vue 3 (`apps/msgops-manager-frontend`):**

- Plugin Auth0 em `src/infra/Auth/Auth.ts` via `createAuth0({ domain, client_id, audience, redirect_uri })`. Registrado em `src/main.ts:51` via `app.use(auth0)`.
- `useAuth0()` (de `@auth0/auth0-vue`) consumido em `src/App.vue:4,14,31-45` (watch no `authUser` que dispara `POST /users/login` após redirect), `src/components/BmsHeader.vue:2,4,9` (logout), `src/router.ts:11,14-22` (guard global que lê `ROLES_CLAIM` e popula `userStore`).
- `authGuard` de `@auth0/auth0-vue` usado como `beforeEnter` em 7 páginas: `pages/Users/UsersPage/index.ts`, `pages/Billing/BillingPage/index.ts`, `pages/Accounts/AccountCreatePage/index.ts`, `pages/Accounts/AccountsPage/index.ts`, `pages/Accounts/AccountEditPage/index.ts`, `pages/Users/UserCreatePage/index.ts`, `pages/Users/UserEditPage/index.ts`.
- Pinia store `useUserStore` (`src/stores/Users/useUserStore.ts`): campo `roles: string[]`, action `setRoles(roles)`. Consumido em `components/BmsSidebar/BmsSidebar.vue:27` (visibilidade por role) e `pages/Billing/BillingPage/BillingPage.vue:167` (`userStore.roles.includes('etus_superbilling')`).
- Rota `/callback` existe para receber o redirect Auth0 (será eliminada).

### Files to Reference

| File                                                                             | Purpose                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/msgops-api/src/auth/jwt.strategy.ts`                                       | **DELETE** — dead code confirmado por grep. Nenhum `@UseGuards(AuthGuard('jwt'))` no repo.                                                                                                                                                                                                                                                                        |
| `apps/msgops-api/src/auth/auth.module.ts`                                        | **DELETE** — só exporta a JwtStrategy acima. Morto junto.                                                                                                                                                                                                                                                                                                         |
| `apps/msgops-api/src/cors.config.ts`                                             | **NOVO ESCOPO** — habilitar `credentials: true` em `createCorsOptions()` e rejeitar `origin === undefined` quando `NODE_ENV === 'production'` (preserva curl/health interno via alternativa: allowlist em variável separada).                                                                                                                                     |
| `apps/msgops-api/src/modules/authz/authz.service.ts`                             | `verifyJwtToken` (linhas ~96-108, **privado**; mantém assinatura, mas corpo passa a delegar a `this.authProvider.verifyToken(token)`), `resolveUserContext` (~110-190), `resolvePrincipalFromRequest` (~283-302), `invalidateUserCache(providerId)` (~58-68, passa a ser invocado em logout/updatePassword).                                                      |
| `apps/msgops-api/src/modules/authz/principal-context.guard.ts`                   | Guard global — **inalterado**.                                                                                                                                                                                                                                                                                                                                    |
| `apps/msgops-api/src/modules/authz/permission.guard.ts`                          | Guard global — **inalterado**.                                                                                                                                                                                                                                                                                                                                    |
| `apps/msgops-api/src/modules/authz/authz.constants.ts`                           | 6 roles + 72 permissions — **inalterado**.                                                                                                                                                                                                                                                                                                                        |
| `apps/msgops-api/src/providers/auth0.provider.ts`                                | Hoje: Management Client direto. Será **movido/renomeado** para `src/modules/auth/providers/auth0-auth.provider.ts` e passar a implementar `IAuthProvider`.                                                                                                                                                                                                        |
| `apps/msgops-api/src/modules/users/users.service.ts`                             | 7 chamadas a `this.auth0.*` nas linhas aprox. **31** (injeção), **231** (createNewUser), **278** (updateUser — profile), **301** (updateUser — picture), **334** (updateUser — admin edit), **406** (updateUserPassword — self), **418** (updateUserPassword — admin). Também `validateJwtFromRequest` (~44-81) e `login(providerId)` (lazy create/lookup).       |
| `apps/msgops-api/src/modules/users/users.controller.ts`                          | `POST /users/login` (~22-41), `POST /users/invite` (~73-77), `GET/PUT /users/me*` (~43-65), CRUD protegido por `@RequirePermission('account:users_*')` (~85-161). `POST /users/login` permanece funcional em modo `auth0`; em modo `local` o fluxo de bootstrap do usuário muda para o `POST /auth/login`.                                                        |
| `apps/msgops-api/src/modules/users/dtos/auth0.dto.ts`                            | Shape usado em `POST /users/login` — permanece p/ retrocompat com `auth0`.                                                                                                                                                                                                                                                                                        |
| `apps/msgops-api/src/entities/users.entity.ts`                                   | **Inalterada**. `provider_id` passa a aceitar formato `local\|<uuid>`.                                                                                                                                                                                                                                                                                            |
| `apps/msgops-api/src/entities/users-account.entity.ts`                           | **Inalterada**.                                                                                                                                                                                                                                                                                                                                                   |
| `apps/msgops-api/src/entities/role.entity.ts`                                    | **Inalterada**.                                                                                                                                                                                                                                                                                                                                                   |
| `apps/msgops-api/src/main.ts`                                                    | Bootstrap do Nest — `cookie-parser` já registrado em linha 47. Plugar `seedAdmin(app.get(DataSource), config, logger)` **após `await NestFactory.create(AppModule)` e antes de `await app.listen(...)`** (o app atual não chama `app.init()`).                                                                                                                    |
| `apps/msgops-api/src/app.module.ts`                                              | Registra o novo `AuthModule` (`src/modules/auth`). Seleção do provider via factory que lê `process.env.AUTH_PROVIDER`.                                                                                                                                                                                                                                            |
| `apps/msgops-api/package.json`                                                   | Adicionar `bcrypt`, `@types/bcrypt`; confirmar `uuid`. Manter `auth0`, `passport-jwt`, `jwks-rsa` enquanto `Auth0AuthProvider` existir.                                                                                                                                                                                                                           |
| `apps/msgops-api/.env.example`                                                   | Adicionar `AUTH_PROVIDER`, `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`. Manter `AUTH0_*`/`JWKS_URI`/`IDP_*` (usado só quando `AUTH_PROVIDER=auth0`).                                                                                                                                                   |
| `apps/frontend-vue2/src/auth/VueAuth.ts`                                         | Remover (SDK Auth0).                                                                                                                                                                                                                                                                                                                                              |
| `apps/frontend-vue2/src/auth/auth.ts`                                            | Refatorar para plugin local (`Vue.use(authPlugin, ...)`) com mesma superfície `this.$auth.{login,logout,getAccessToken,user,isAuthenticated}`.                                                                                                                                                                                                                    |
| `apps/frontend-vue2/src/auth/User.ts`                                            | Simplificar — dados agora vêm de `GET /users/me`, não do ID token.                                                                                                                                                                                                                                                                                                |
| `apps/frontend-vue2/src/auth/guards/auth.guard.ts`                               | Mudar de "se não logado, `loginWithRedirect`" para "se não logado, `router.push('/login')`".                                                                                                                                                                                                                                                                      |
| `apps/frontend-vue2/src/services/auth.service.ts`                                | Reescrever: `login(email,pwd)` POSTa `/auth/login`; `getAccessToken()` retorna access in-memory; `logout()` limpa + POSTa `/auth/logout`.                                                                                                                                                                                                                         |
| `apps/frontend-vue2/src/services/api.service.ts:28-43`                           | Mantém `Authorization: Bearer`. Adicionar interceptor 401 → tenta refresh → retry 1x → senão `logout()`.                                                                                                                                                                                                                                                          |
| `apps/frontend-vue2/src/main.ts`                                                 | Substituir `Vue.use(auth0Plugin, ...)` (linhas ~159-166) por `Vue.use(localAuthPlugin, {...})`.                                                                                                                                                                                                                                                                   |
| `apps/frontend-vue2/src/router.ts`                                               | Adicionar rota `{ path: '/login', component: LoginPage, meta: { public: true } }`.                                                                                                                                                                                                                                                                                |
| `apps/frontend-vue2/src/pages/login/LoginPage.vue`                               | **NOVO** — form email/senha → `authService.login()` → redirect.                                                                                                                                                                                                                                                                                                   |
| `apps/frontend-vue2/.env.example`                                                | Remover `VUE_APP_AUTH0_DOMAIN`, `VUE_APP_AUTH0_CLIENT_ID`, `VUE_APP_AUTH0_AUDIENCE`, `VUE_APP_AUTH0_ROLES_CLAIM`. **NÃO remover** `VUE_APP_REDIRECT_MANAGER` (não é Auth0).                                                                                                                                                                                       |
| `apps/frontend-vue2/package.json`                                                | Remover `@auth0/auth0-spa-js`.                                                                                                                                                                                                                                                                                                                                    |
| `apps/msgops-manager-frontend/src/infra/Auth/Auth.ts`                            | Substituir `createAuth0(...)` por config local (`apiBaseUrl`, TTLs).                                                                                                                                                                                                                                                                                              |
| `apps/msgops-manager-frontend/src/composables/useAuth.ts`                        | **NOVO** — shape compatível com `useAuth0()` usado em `App.vue` e `BmsHeader.vue`: retorna `{ isAuthenticated, isLoading, user, loginWithRedirect, logout }`. `loginWithRedirect` = `router.push('/login')`.                                                                                                                                                      |
| `apps/msgops-manager-frontend/src/main.ts:51`                                    | Substituir `app.use(auth0)` por `app.use(authLocalPlugin)` (se houver plugin) ou apenas remover.                                                                                                                                                                                                                                                                  |
| `apps/msgops-manager-frontend/src/App.vue:4,14,31-45`                            | Trocar import `useAuth0` → `useAuth`. Watch `authUser` → reage a `isAuthenticated`, chama `POST /auth/me` ou `GET /users/me` e popula store.                                                                                                                                                                                                                      |
| `apps/msgops-manager-frontend/src/router.ts:11,14-22`                            | Remover `ROLES_CLAIM` e leitura do custom claim. Guard passa a chamar `GET /users/me?accountId=X` e setar `userStore` com `role`, `permissions`, etc. Remover rota `/callback`. Adicionar rota `/login`.                                                                                                                                                          |
| `apps/msgops-manager-frontend/src/components/BmsHeader.vue:2,4,9`                | Trocar `useAuth0` por `useAuth`.                                                                                                                                                                                                                                                                                                                                  |
| `apps/msgops-manager-frontend/src/components/BmsSidebar/BmsSidebar.vue:27`       | **Auditar** — itens do sidebar usam `hideFromRoles`. Garantir que valores batem com role codes do DB (`super_admin`/`admin`/`editor`/`analyst`/`support`/`billing`). Remover strings legadas do Auth0 se houver.                                                                                                                                                  |
| `apps/msgops-manager-frontend/src/pages/Billing/BillingPage/BillingPage.vue:167` | **MUDAR** — substituir `userStore.roles.includes('etus_superbilling')` (cross-tenant visibility legada) por check explícito. Opção A: `userStore.effectiveRole === 'billing'`. Opção B: flag booleana `canSeeAllAccounts` emitida em `/users/me`. **Decidir no Grupo 5; recomendação: B (flag explícita) para não acoplar semântica a role code**.                |
| `apps/msgops-manager-frontend/src/router.ts:11-12,25-28`                         | **MUDAR** — remover `ROLES_CLAIM` e `BILLING_ONLY_ROLE`. Redirect `/users` e `/accounts` → `/billing` passa a usar `userStore.effectiveRole === 'billing'` (**NÃO** `superbilling` Auth0 legado — isso é user-type distinto, conflar causa route-DoS). Se o adopter realmente precisar de "billing-only viewer" que não é o role `billing` do DB, fica como v0.2. |
| `apps/msgops-manager-frontend/src/pages/Users/UsersPage/index.ts` (+6 outros)    | Trocar `import { authGuard } from '@auth0/auth0-vue'` por `import { authGuard } from '@/router/guards'` (novo).                                                                                                                                                                                                                                                   |
| `apps/msgops-manager-frontend/src/pages/Login/LoginPage.vue`                     | **NOVO**.                                                                                                                                                                                                                                                                                                                                                         |
| `apps/msgops-manager-frontend/.env.example`                                      | Remover `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `VITE_AUTH0_CALLBACK_URL`, `VITE_AUTH0_ROLES_CLAIM`, `VITE_AUTH0_BILLING_ONLY_ROLE`.                                                                                                                                                                                                  |
| `apps/msgops-manager-frontend/package.json`                                      | Remover `@auth0/auth0-vue`.                                                                                                                                                                                                                                                                                                                                       |
| `apps/msgops-manager-frontend/README.md`                                         | Reescrever seção Auth.                                                                                                                                                                                                                                                                                                                                            |
| `CLAUDE.md` (raiz)                                                               | Corrigir: **não** é `@auth0/nextjs-auth0`; backend é `msgops-api`, não `backoffice-api`. Anotar novo modelo de auth plugável.                                                                                                                                                                                                                                     |
| `README.md` (raiz)                                                               | Reescrever seção Auth + remover env `AUTH0_*` dos exemplos de `gcloud ... --set-secrets`.                                                                                                                                                                                                                                                                         |

### Technical Decisions

**Arquitetura do provider:**

- Interface `IAuthProvider` em `src/modules/auth/providers/auth.provider.interface.ts` com métodos:
  - `createUser(input: { email, name, password?, picture? }): Promise<{ providerId: string }>`
  - `updateUser(providerId, patch: Partial<{ email, name, picture }>): Promise<void>`
  - `updatePassword(providerId, newPassword): Promise<void>`
  - `deleteUser(providerId): Promise<void>`
  - `verifyToken(accessToken): Promise<JwtPayload>` — normaliza claims (`sub`, `email`, `name`, `picture`, `aud`, `iss`).
  - `issueToken?(user): Promise<{ accessToken, refreshToken, expiresIn }>` — opcional (só `LocalAuthProvider`).
  - `refreshToken?(refreshToken): Promise<{ accessToken, refreshToken, expiresIn }>` — opcional.
  - `revokeRefreshToken?(refreshToken): Promise<void>` — opcional.
- Seleção por factory em `app.module.ts`: `useFactory` lê `process.env.AUTH_PROVIDER` (default `'local'`). Token DI: `AUTH_PROVIDER` (string injetado via `@Inject('AUTH_PROVIDER')`).
- `UsersService` deixa de depender de `Auth0Provider` concreto; injeta `IAuthProvider`.

**Crypto:**

- Senha: bcrypt, **12 rounds** (custo ~300ms em hardware moderno).
- Access token: JWT HS256 assinado com `JWT_SECRET` (≥32 chars aleatórios). TTL default 3600s (`JWT_ACCESS_TTL`).
- Refresh token: UUID v4 opaco. Persistido em `user_refresh_tokens` como SHA-256 do valor (nunca em claro). TTL default 2592000s (30d, `JWT_REFRESH_TTL`). Rotação a cada `/auth/refresh` (revoga anterior, emite novo). Entregue ao cliente em cookie httpOnly `SameSite=Lax`, `Secure` em produção, **`Path=/`** (não `/auth` — para funcionar com deployments atrás de reverse proxy que mapeia `/api/*` para o Nest).
- Payload do JWT local mantém compatibilidade com o que `AuthzService.resolveUserContext` lê hoje: `sub` (= `provider_id = 'local|<user.id>'` ou `'local|<uuid>'`), `email`, `name`, `picture`, `iss='bms-msgops-api'`, `aud` igual ao `IDP_AUDIENCE` atual (para não quebrar a validação) — ou remover validação de `aud/iss` no caminho `local` e ler direto.

**JWT validation unificada (decidido):**

- `JwtStrategy` e `src/auth/auth.module.ts` são **deletados** — são dead code (zero `@UseGuards(AuthGuard('jwt'))` no repo, confirmado por grep). Dependências `passport-jwt` e `passport` podem ser removidas do `package.json`, a menos que outro código não-auth use Passport (verificar no T3.3). `jwks-rsa` permanece — `Auth0AuthProvider.verifyToken` usa diretamente.
- `AuthzService.verifyJwtToken` permanece como método `private` de AuthzService, mas seu corpo passa a delegar: `return this.authProvider.verifyToken(token);`. O provider injetado é o único ponto de validação.

**Bootstrap admin:**

- Arquivo: `src/bootstrap/seed-admin.ts` exportando `async function seedAdmin(dataSource, config, logger)`.
- Lógica com advisory lock para evitar race em deployments multi-réplica:
  1. `SELECT pg_try_advisory_lock(834729)` (chave arbitrária). Se não obtém lock (outra réplica já está rodando seed), aguarda `pg_advisory_lock(834729)` e depois confere de novo.
  2. `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`. Se `> 0`, `pg_advisory_unlock(834729)`, log "skipped" e retorna.
  3. Lê `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD`. Se ausentes, unlock e `throw new Error('Empty users table requires BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD envs')`.
  4. Valida `password.length >= 8` (alinhado ao DTO de login); se menor, unlock e `throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters')`.
  5. Busca `RoleEntity.code='super_admin'`; se ausente, unlock e `throw new Error('RBAC seed missing — run migrations first')`.
  6. Gera `providerId='local|<uuid>'`. INSERT em `users` e `user_credentials` (bcrypt 12) em transação.
  7. `pg_advisory_unlock(834729)`. Log "Bootstrap admin created: <email>".
- Chamado em `main.ts` **após `await NestFactory.create(AppModule)` e antes de `await app.listen(...)`**.

**Migrations novas:**

- `user_credentials`:
  ```sql
  id BIGSERIAL PK
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
  password_hash VARCHAR(60) NOT NULL   -- bcrypt: 60 chars exatos
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  ```
  (sem coluna `salt` — bcrypt embute o salt no próprio hash)
- `user_refresh_tokens`:
  ```sql
  id BIGSERIAL PK
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE
  token_hash VARCHAR(64) NOT NULL UNIQUE   -- SHA-256 hex
  expires_at TIMESTAMPTZ NOT NULL
  revoked_at TIMESTAMPTZ NULL
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  user_agent TEXT NULL
  ip INET NULL
  INDEX idx_user_refresh_tokens_user_id (user_id)
  INDEX idx_user_refresh_tokens_expires (expires_at)
  ```

**Endpoints novos (`AuthModule`):**

- `POST /auth/login` — body `{ email, password }`. Resp: `{ user, accessToken, expiresIn }` + cookie httpOnly `bms_refresh`. Público (`@PublicRoute`).
- `POST /auth/refresh` — lê cookie `bms_refresh`. Resp: novo `{ accessToken, expiresIn }` + rotaciona cookie. Público.
- `POST /auth/logout` — revoga refresh token do cookie, limpa cookie. Público (não exige JWT válido; idempotente).

**Tratamento do `POST /users/login` legado (decidido):**

- Em modo `auth0`, permanece funcionando como hoje (recebe Auth0 JWT → extrai `sub` → lazy create).
- Em modo `local`, **retorna `410 Gone`** com mensagem `This endpoint is deprecated under AUTH_PROVIDER=local. Use POST /auth/login.`. Nenhum lazy-create; admins criam users via `POST /users/invite` (que chama `LocalAuthProvider.createUser` com senha).

**Eliminação do custom roles claim (decidido, sem virtual roles hack):**

- Após login (backend devolve `{ user, accessToken }`), o frontend chama `GET /users/me` para obter `PrincipalContext` completo (`role`, `effectiveRole`, `permissions[]`, `isSuperAdmin`, `canSeeAllAccounts`).
- Frontend popula `userStore.roles` = **apenas códigos reais dos roles do DB** (`super_admin`, `admin`, `editor`, `analyst`, `support`, `billing`). **Nada de virtual roles** — a tentação de injetar `superbilling`/`etus_superbilling` baseado em `effectiveRole==='billing'` foi rejeitada: são dois user-types distintos (route-DoS em `/users` e `/accounts` para `superbilling`; cross-tenant visibility para `etus_superbilling`), conflar causa escalação de privilégio + route-DoS.
- Consumo no frontend passa a ser explícito:
  - `BmsSidebar.vue:27` — `hideFromRoles` auditado contra role codes reais do DB.
  - `BillingPage.vue:167` — substituir `userStore.roles.includes('etus_superbilling')` por check de flag explícita. **Recomendação**: backend emite `canSeeAllAccounts: boolean` em `/users/me` (true quando `isSuperAdmin` OU `effectiveRole === 'billing'`), frontend consome isso. Decisão final no Grupo 5 (T5.14).
  - `router.ts:25-28` — trocar `userStore.roles.includes(BILLING_ONLY_ROLE)` por `userStore.effectiveRole === 'billing'`. O Auth0 role legado `superbilling` (billing-only viewer cross-tenant) não é portado — fica em backlog v0.2 se adopter precisar.

### Technical Preferences and Constraints (coletados na discovery)

**Decisões travadas pelo product owner (Guilherme):**

1. **Forgot password fora de V0.1** — reset via endpoint admin existente (`PUT /users/update-password/:id`). Sem SMTP, sem tela de "esqueci minha senha".
2. **JWT HS256**, secret único em `JWT_SECRET`. RS256 descartado por complexidade desnecessária no contexto OSS self-hosted single-deployment.
3. **Elimina custom roles claim namespaced** (`https://your-domain.example.com/roles`, `superbilling`, `etus_superbilling`). Frontends passam a ler roles via `GET /users/me` — que já expõe o `PrincipalContext` resolvido pelo backend a partir do DB. Isso também corrige a inconsistência pré-existente "roles do claim Auth0 não batem com roles do DB".
4. **Bootstrap admin** via `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD` no boot do `msgops-api`, rodando **apenas** quando tabela `users` estiver vazia (idempotente).

**Restrições arquiteturais observadas no código atual:**

- RBAC completo já é local (6 roles sistêmicos seeded via migration `1771800000000-create-rbac-core.ts`; 72 permission keys em `src/modules/authz/authz.constants.ts`). **Nenhuma mudança** em `UserEntity`, `UserAccountEntity`, `RoleEntity`.
- `provider_id` em `UserEntity` é chave genérica; `LocalAuthProvider` usa formato `local|<uuid>`. Para usuários já existentes migrados de `auth0|...`, o provider_id permanece como está; novo login local exige uma relação pelo `email` (unique) na conversão.
- Guards (`PrincipalContextGuard`, `PermissionGuard`) e decorators (`@RequirePermission`, `@RequireSuperAdmin`, `@PublicRoute`) são preservados inteiros — a mudança é apenas em **como** o `PrincipalContext` é resolvido (provider-agnóstico).
- API Key path (`AuthzService.resolveApiKeyContext`) é ortogonal e não é tocado.
- `ClsService` continua sendo a forma de propagar contexto por request.

**Formato de token e refresh:**

- Access token JWT HS256, TTL padrão 1h (`JWT_ACCESS_TTL=3600`).
- Refresh token opaco UUIDv4, TTL 30 dias (`JWT_REFRESH_TTL=2592000`), persistido como hash em `user_refresh_tokens`, entregue ao cliente em cookie httpOnly com `SameSite=Lax` + `Secure` em produção + `Path=/`.
- Rotação de refresh a cada uso (emite novo par, invalida o anterior). UPDATE atômico `WHERE revoked_at IS NULL RETURNING *` mitiga race de duplo refresh.
- Logout invalida o refresh ativo do cookie **E** invoca `AuthzService.invalidateUserCache(providerId)` para que o PrincipalContext cached no Redis (TTL 5min) seja derrubado imediatamente.
- Access token armazenado pelo frontend **apenas em memória** — sem `sessionStorage`/`localStorage` (proteção contra XSS). Hard reload da página dispara `POST /auth/refresh` silencioso usando o cookie httpOnly; se refresh falha (cookie expirado/ausente), redirect para `/login`.
- `JWT_AUDIENCE` (local) é **independente** de `IDP_AUDIENCE` (Auth0). Startup valida que os dois existem quando necessários: em modo `local`, exige `JWT_SECRET` + `JWT_AUDIENCE`; em modo `auth0`, exige `JWKS_URI` + `IDP_AUDIENCE` + `IDP_ISSUER`. Config faltando → falha fast no boot.

## Implementation Plan

### Tasks

Ordem obrigatória: cada grupo depende do anterior. Dentro do grupo, tasks podem ser paralelizadas se marcado.

#### Grupo 1 — Backend: Fundação (schema + interface)

- [x] **T1.1** — Adicionar dependências npm ao backend
  - File: `apps/msgops-api/package.json`
  - Action: adicionar `bcrypt@^5.1.1` + `@types/bcrypt@^5.0.2`; adicionar `uuid@^9.0.0` + `@types/uuid@^9.0.0` (**ambos ausentes hoje**, grep confirmou). `jsonwebtoken` e `cookie-parser` já estão instalados — **não** re-adicionar. Avaliar remoção de `passport` + `passport-jwt` se T3.3 confirmar deleção de `JwtStrategy` e ninguém mais usa Passport.
  - Notes: rodar `pnpm install` após edit. Manter `auth0`, `jwks-rsa`, `jsonwebtoken` — continuam usados pelo `Auth0AuthProvider`.

- [x] **T1.2** — Criar migration `user_credentials`
  - File: `apps/msgops-api/src/migrations/<timestamp>-create-user-credentials.ts`
  - Action: classe TypeORM `CreateUserCredentials<timestamp>` com `up()` criando tabela com colunas: `id BIGSERIAL PK`, `user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE`, `password_hash VARCHAR(60) NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. `down()` dropa a tabela.
  - Notes: sem coluna `salt` — bcrypt embute. Timestamp deve ser maior que `1771800000000-create-rbac-core.ts` para rodar depois.

- [x] **T1.3** — Criar migration `user_refresh_tokens`
  - File: `apps/msgops-api/src/migrations/<timestamp+1>-create-user-refresh-tokens.ts`
  - Action: `up()` cria tabela com `id BIGSERIAL PK`, `user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `token_hash VARCHAR(64) NOT NULL UNIQUE`, `expires_at TIMESTAMPTZ NOT NULL`, `revoked_at TIMESTAMPTZ NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `user_agent TEXT NULL`, `ip INET NULL`. Índices em `user_id` e `expires_at`. `down()` dropa.

- [x] **T1.4** — Criar entity `UserCredentialsEntity`
  - File: `apps/msgops-api/src/entities/user-credentials.entity.ts`
  - Action: classe `UserCredentialsEntity` com `@Entity('user_credentials')`, `@PrimaryGeneratedColumn('increment', { type: 'bigint' }) id`, `@Column({ name: 'user_id' }) userId: number`, `@Column({ name: 'password_hash', length: 60 }) passwordHash: string`, `@CreateDateColumn({ name: 'created_at' }) createdAt: Date`, `@UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date`, `@OneToOne(() => UserEntity) @JoinColumn({ name: 'user_id' }) user: UserEntity`.

- [x] **T1.5** — Criar entity `UserRefreshTokenEntity`
  - File: `apps/msgops-api/src/entities/user-refresh-token.entity.ts`
  - Action: classe com `@Entity('user_refresh_tokens')`, campos mapeando 1:1 a migration T1.3. Incluir índices via `@Index(['userId'])` e `@Index(['expiresAt'])`.

- [x] **T1.6** — Criar interface `IAuthProvider`
  - File: `apps/msgops-api/src/modules/auth/providers/auth.provider.interface.ts`
  - Action: exportar token DI `AUTH_PROVIDER_TOKEN = Symbol('AUTH_PROVIDER')`, interface `IAuthProvider` com métodos:
    - `createUser(input: CreateAuthUserInput): Promise<{ providerId: string }>`
    - `updateUser(providerId: string, patch: UpdateAuthUserInput): Promise<void>`
    - `updatePassword(providerId: string, newPassword: string): Promise<void>`
    - `deleteUser(providerId: string): Promise<void>`
    - `verifyToken(accessToken: string): Promise<NormalizedJwtPayload>`
    - `supportsCredentialLogin(): boolean` (guard rail — `LocalAuthProvider` true, `Auth0AuthProvider` false)
    - `login?(email: string, password: string): Promise<AuthTokens>` (só `LocalAuthProvider`)
    - `refresh?(refreshToken: string, meta: { userAgent?: string; ip?: string }): Promise<AuthTokens>`
    - `logout?(refreshToken: string): Promise<void>`
  - Também exportar types: `CreateAuthUserInput { email; name; password?; picture? }`, `UpdateAuthUserInput { email?; name?; picture? }`, `NormalizedJwtPayload { sub; email?; name?; picture?; email_verified?; aud; iss; exp; iat }`, `AuthTokens { accessToken; refreshToken; expiresIn }`.

#### Grupo 2 — Backend: Providers

- [x] **T2.1** — Refatorar `Auth0Provider` → `Auth0AuthProvider`
  - File (mover): `apps/msgops-api/src/providers/auth0.provider.ts` → `apps/msgops-api/src/modules/auth/providers/auth0-auth.provider.ts`
  - Action: classe passa a `implements IAuthProvider`. Adicionar métodos novos: `verifyToken(token)` (copia `AuthzService.verifyJwtToken` atual — `jsonwebtoken.verify` + `jwks-rsa`); `supportsCredentialLogin()` retorna `false`; adaptar `createNewUser`→`createUser`, `updateUser` recebe `(providerId, patch)`, `updateUserPassword`→`updatePassword`, `deleteUser` inalterado. Remover `getUsers()` e `getUserByEmail()` da interface pública (podem ficar como helpers privados se ainda forem usados internamente — verificar no code review).
  - Notes: manter mesmas envs (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `JWKS_URI`, `IDP_ISSUER`, `IDP_AUDIENCE`).

- [x] **T2.2** — Criar `LocalAuthProvider`
  - File: `apps/msgops-api/src/modules/auth/providers/local-auth.provider.ts`
  - Action: `@Injectable()` class `LocalAuthProvider implements IAuthProvider`. Injetar repos `UserEntity`, `UserCredentialsEntity`, `UserRefreshTokenEntity`, `ConfigService`, `AuthzService` (para invalidação de cache) e `Logger`. Implementar:
    - `createUser({ email, name, password, picture })`: gera `providerId = 'local|' + uuid()`; cria `UserEntity` com campos recebidos; se `password` presente, bcrypt-hash (12 rounds) e salva `UserCredentialsEntity`. Retorna `{ providerId }`.
    - `updateUser(providerId, patch)`: `UPDATE users SET ... WHERE provider_id = providerId AND deleted_at IS NULL`.
    - `updatePassword(providerId, newPassword)`: **guard**: `if (!providerId.startsWith('local|')) throw new BadRequestException('LocalAuthProvider cannot update non-local provider user')`. Bcrypt-hash, upsert em `user_credentials`, chamar `authzService.invalidateUserCache(providerId)` (F14 — logout imediato).
    - `deleteUser(providerId)`: soft delete em `users`, cascata FK derruba credentials/tokens, invalidar cache.
    - `verifyToken(token)`: `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: 'bms-msgops-api', audience: JWT_AUDIENCE })`. Retorna payload normalizado. Lança `UnauthorizedException` em erro.
    - `supportsCredentialLogin()`: `true`.
    - `login(email, password)`: busca `UserEntity` por `email` (ativo, not deleted); busca `UserCredentialsEntity`; `bcrypt.compare`; se falha → `UnauthorizedException('Invalid credentials')` (mensagem genérica, não revela se email existe). Gera `accessToken` (HS256, TTL `JWT_ACCESS_TTL`, claims `sub=providerId, email, name, picture, email_verified, iss='bms-msgops-api', aud=JWT_AUDIENCE`). Gera `refreshToken = uuid()`; armazena `sha256(refreshToken)` em `user_refresh_tokens` com `expires_at = now() + JWT_REFRESH_TTL`. Retorna `{ accessToken, refreshToken, expiresIn }`.
    - `refresh(refreshToken, meta)`: `sha256` do input. **UPDATE atômico**: `UPDATE user_refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW() RETURNING user_id` — se 0 linhas afetadas, distinguir entre "nunca existiu" (401 normal) e "já revogado" (**logar estruturado** `{ event: 'refresh_token_reuse_detected', tokenHash, userAgent, ip }` + 401). Se 1 linha, emite novo par + novo cookie.
    - `logout(refreshToken)`: `sha256` → `UPDATE ... SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`. Idempotente. Também busca o `user_id` da row e chama `authzService.invalidateUserCache(providerId)` para derrubar o cache Redis imediatamente.

- [x] **T2.3** — Criar `AuthService` de alto nível (thin orchestrator)
  - File: `apps/msgops-api/src/modules/auth/auth.service.ts`
  - Action: `@Injectable()` injetando `IAuthProvider` via `@Inject(AUTH_PROVIDER_TOKEN)`. Métodos públicos: `login(dto, meta)`, `refresh(token, meta)`, `logout(token)`. Cada um delega ao provider e lança `ForbiddenException` se `!provider.supportsCredentialLogin()`.

- [x] **T2.4** — Criar DTOs
  - Files:
    - `apps/msgops-api/src/modules/auth/dto/login.dto.ts` — class-validator: `@IsEmail() email`, `@IsString() @MinLength(8) password`.
    - `apps/msgops-api/src/modules/auth/dto/auth-response.dto.ts` — `{ accessToken: string; expiresIn: number; user: { id; email; name; picture; providerId } }`.

- [x] **T2.5** — Criar `AuthController`
  - File: `apps/msgops-api/src/modules/auth/auth.controller.ts`
  - Action: `@Controller('auth')`. Rotas:
    - `@Post('login') @PublicRoute() login(@Body() dto: LoginDto, @Req() req, @Res({ passthrough: true }) res)`: chama `authService.login(dto, { userAgent: req.headers['user-agent'], ip: req.ip })`; seta cookie `bms_refresh` com `httpOnly: true, secure: NODE_ENV==='production', sameSite: 'lax', path: '/', maxAge: JWT_REFRESH_TTL * 1000`; retorna `AuthResponseDto` (access token + user, sem refresh no body).
    - `@Post('refresh') @PublicRoute() refresh(@Req() req, @Res({ passthrough: true }) res)`: lê cookie `bms_refresh`; se ausente → 401; chama `authService.refresh(token, { userAgent, ip })`; rotaciona cookie; retorna `{ accessToken, expiresIn }`.
    - `@Post('logout') @PublicRoute() logout(@Req() req, @Res({ passthrough: true }) res)`: lê cookie; chama `authService.logout(token)`; limpa cookie (`res.clearCookie('bms_refresh', { path: '/' })`); retorna `{ success: true }`.
  - Notes: `@ApiTags('auth')` + OpenAPI. Cookie `Path=/` (não `/auth`) para suportar deploys com prefixo de reverse proxy (F1).

- [x] **T2.6** — Criar `AuthModule` com factory de provider + registro condicional do controller
  - File: `apps/msgops-api/src/modules/auth/auth.module.ts`
  - Action: `@Module`. `imports: [TypeOrmModule.forFeature([UserEntity, UserCredentialsEntity, UserRefreshTokenEntity]), ConfigModule, forwardRef(() => AuthzModule)]` (forwardRef porque `LocalAuthProvider` injeta `AuthzService` para invalidar cache). `providers`:
    ```ts
    {
      provide: AUTH_PROVIDER_TOKEN,
      useFactory: (config: ConfigService, localProvider: LocalAuthProvider, auth0Provider: Auth0AuthProvider) => {
        const choice = config.get('AUTH_PROVIDER', 'local');
        if (choice !== 'local' && choice !== 'auth0') throw new Error(`Invalid AUTH_PROVIDER: ${choice}`);
        return choice === 'auth0' ? auth0Provider : localProvider;
      },
      inject: [ConfigService, LocalAuthProvider, Auth0AuthProvider],
    },
    LocalAuthProvider, Auth0AuthProvider, AuthService
    ```
  - **`controllers`** (registro condicional — F11): `controllers: process.env.AUTH_PROVIDER === 'auth0' ? [] : [AuthController]`. Em modo `auth0`, `POST /auth/login` retorna 404 (rota não montada), não 403 com DTO Forbidden (evita confusão + ruído para scanners).
  - `exports: [AUTH_PROVIDER_TOKEN, AuthService]`.

- [x] **T2.7** — Registrar `AuthModule` e deprecar `src/providers/auth0.provider.ts`
  - File: `apps/msgops-api/src/app.module.ts`
  - Action: adicionar `AuthModule` em `imports`. Remover o `Providers` antigo (se estava registrando `Auth0Provider`) — passa a ser fornecido pelo `AuthModule`. Em `apps/msgops-api/src/providers/auth0.provider.ts` (arquivo original): deletar o arquivo (já movido em T2.1).

- [ ] **~~T2.8~~** — ~~Adicionar `cookie-parser` no bootstrap~~ **REMOVIDO** — `cookie-parser` já instalado (`package.json:50`) e wired em `main.ts:6,47` (F8).

#### Grupo 3 — Backend: Integração com Users + Authz

- [x] **T3.1** — Refatorar `UsersService` para depender de `IAuthProvider`
  - File: `apps/msgops-api/src/modules/users/users.service.ts`
  - Action:
    - Linha ~31: `@Inject(AUTH_PROVIDER_TOKEN) private readonly authProvider: IAuthProvider` (remover `private readonly auth0: Auth0Provider`).
    - Linha ~231 (`create`): `const created = await this.authProvider.createUser({ email, name, password, picture }); userDto.provider_id = created.providerId;` (substitui `this.auth0.createNewUser(...)`).
    - Linha ~278 (`updateProfile`): `await this.authProvider.updateUser(user.providerId, profileDto);`
    - Linha ~301 (`uploadProfilePicture`): `await this.authProvider.updateUser(user.providerId, { picture: result.link });`
    - Linha ~334 (`update`): `await this.authProvider.updateUser(user.providerId, { email, name, picture });`
    - Linha ~406 (`updateMyPassword`): **substituir** check `providerId.startsWith('auth0|')` por guard provider-aware — em modo `local` exige `providerId.startsWith('local|')`, em modo `auth0` exige `auth0|`. Se mismatch, 400 com msg clara ("User is not managed by the active auth provider"). `await this.authProvider.updatePassword(user.providerId, password);` Dispara invalidação de cache via o próprio provider.
    - Linha ~418 (`updatePassword`): idem com mesmo guard.
    - `validateJwtFromRequest(req)` (~linhas 44-81): remover; chamar `this.authProvider.verifyToken(token)` ou delegar para `authzService.verifyJwtToken` que já delega ao provider.
  - File: `apps/msgops-api/src/modules/users/users.module.ts`
  - Action: adicionar `AuthModule` em `imports` (para poder injetar `AUTH_PROVIDER_TOKEN`). Remover qualquer provider antigo de `Auth0Provider`.

- [x] **T3.2** — Atualizar `AuthzService.verifyJwtToken` para delegar ao provider
  - File: `apps/msgops-api/src/modules/authz/authz.service.ts`
  - Action: `verifyJwtToken` permanece **privado**, assinatura inalterada. Corpo (linhas ~96-108) passa a ser `return this.authProvider.verifyToken(token);`. Injetar `@Inject(AUTH_PROVIDER_TOKEN) private readonly authProvider: IAuthProvider` via construtor. Remover `jwksClient` e dependências de `jwks-rsa`/`jsonwebtoken` **deste arquivo** (permanecem usadas em `Auth0AuthProvider.verifyToken`).
  - File: `apps/msgops-api/src/modules/authz/authz.module.ts`
  - Action: importar `forwardRef(() => AuthModule)` e adicionar em `imports`. `AuthzService` continua exportado (usado por `PrincipalContextGuard` e `LocalAuthProvider` — cadeia mutual via forwardRef).

- [x] **T3.3** — DELETAR `JwtStrategy` e `src/auth/auth.module.ts` (decidido — dead code)
  - Files (DELETE): `apps/msgops-api/src/auth/jwt.strategy.ts`, `apps/msgops-api/src/auth/auth.module.ts`, `apps/msgops-api/src/auth/` (pasta inteira se vazia após remover os dois).
  - Action: verificado por grep — zero `@UseGuards(AuthGuard('jwt'))` ou `AuthGuard('jwt')` no repo. Remover imports referentes em `app.module.ts` se houver. Remover `passport` e `passport-jwt` do `package.json` (se nada mais usa). Manter `jwks-rsa` e `jsonwebtoken` (usados por `Auth0AuthProvider`).
  - Notes: após deletar, rodar `pnpm type-check` no `apps/msgops-api` para confirmar ausência de referências quebradas.

- [x] **T3.4** — Adaptar `/users/me` para emitir roles DB + flags explícitas (SEM virtual roles)
  - File: `apps/msgops-api/src/modules/users/users.service.ts`
  - Action: na função `getMe(providerId, accountId)`, no bloco de montagem do response, adicionar:
    ```ts
    const roles: string[] = [];
    if (isSuperAdmin) roles.push('super_admin');
    if (effectiveRole) roles.push(effectiveRole);
    // Flags explícitas substituem as "virtual roles" Auth0 legadas:
    const canSeeAllAccounts = isSuperAdmin || effectiveRole === 'billing';
    ```
    Retornar `roles`, `isSuperAdmin`, `canSeeAllAccounts` junto com `effectiveRole`/`globalRole`/`permissions` existentes.
  - **NÃO emitir** `superbilling` ou `etus_superbilling` no array `roles` — são user-types Auth0 distintos (F4). Frontend Vue3 (T5.14/T5.15) passa a consumir `effectiveRole` e `canSeeAllAccounts` direto.
  - Notes: isso elimina o custom claim Auth0 namespaced sem introduzir regressão de privilégio.

- [x] **T3.5** — Criar bootstrap de admin (com advisory lock anti-race)
  - File: `apps/msgops-api/src/bootstrap/seed-admin.ts`
  - Action: exportar `async function seedAdmin(dataSource: DataSource, config: ConfigService, logger: Logger): Promise<void>`. Lógica:
    1. Obter `QueryRunner` + iniciar transação.
    2. `await queryRunner.query('SELECT pg_advisory_xact_lock(834729)')` — advisory lock transação-scoped, auto-release ao commit/rollback. Com réplicas concorrentes, apenas uma entra no critical section por vez.
    3. `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`. Se `> 0`, commit (libera lock), log "Bootstrap admin: skipped (users table not empty)", retorna.
    4. `const email = config.get('BOOTSTRAP_ADMIN_EMAIL'); const password = config.get('BOOTSTRAP_ADMIN_PASSWORD');`
    5. Se `!email || !password`, rollback e `throw new Error('Empty users table requires BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD envs')`.
    6. Se `password.length < 8`, rollback e `throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters (to match /auth/login DTO)')` (F16).
    7. Buscar `RoleEntity.code='super_admin'` — se ausente, rollback e `throw new Error('RBAC seed missing — run migrations first')`.
    8. Gerar `providerId = 'local|' + uuid()`. INSERT `UserEntity { email, name: 'Admin', providerId, status: 'active', globalRoleId: superAdminRole.id }`.
    9. `const hash = await bcrypt.hash(password, 12);` INSERT `UserCredentialsEntity { userId: savedUser.id, passwordHash: hash }`.
    10. Commit (libera lock). Log `Bootstrap admin created: <email>`.
  - Notes: `pg_advisory_xact_lock` é automaticamente liberado no fim da transação — não precisa de unlock manual. Seguro em multi-réplica (F5).

- [x] **T3.6** — Wire do bootstrap em `main.ts`
  - File: `apps/msgops-api/src/main.ts`
  - Action: após `const app = await NestFactory.create(AppModule)` (já existente na linha 21) e **antes** de `await app.listen(process.env.SERVER_PORT)` (linha ~51):
    ```ts
    const config = app.get(ConfigService);
    if (config.get('AUTH_PROVIDER', 'local') === 'local') {
      await seedAdmin(app.get(DataSource), config, new Logger('SeedAdmin'));
    }
    ```
  - Notes: só roda em modo `local`. Em modo `auth0`, skip. **NÃO** chamar `app.init()` — o atual `main.ts` não usa `init()`, e `app.listen()` já faz init implicitamente (F9).

- [x] **T3.7** — Atualizar `.env.example` backend + guard de config no boot
  - File: `apps/msgops-api/.env.example`
  - Action: adicionar (no topo da seção Auth):

    ```env
    # Auth provider selection: local | auth0 (default: local)
    AUTH_PROVIDER=local

    # Local provider (used when AUTH_PROVIDER=local)
    # Gere com: openssl rand -hex 32
    JWT_SECRET=replace-with-openssl-rand-hex-32
    JWT_ACCESS_TTL=3600
    JWT_REFRESH_TTL=2592000
    # JWT_AUDIENCE é independente de IDP_AUDIENCE (Auth0) — use qualquer string estável
    JWT_AUDIENCE=bms-msgops-api
    # Bootstrap admin (usado apenas no primeiro boot em DB vazia)
    BOOTSTRAP_ADMIN_EMAIL=admin@example.com
    BOOTSTRAP_ADMIN_PASSWORD=ChangeMeOnFirstBoot!
    ```

    Manter vars `AUTH0_*`, `JWKS_URI`, `IDP_ISSUER`, `IDP_AUDIENCE` — anotar "only used when AUTH_PROVIDER=auth0".

  - File: `apps/msgops-api/src/main.ts` (ou em `ConfigModule` validation schema)
  - Action: adicionar guard de startup que valida envs mínimas por provider: modo `local` exige `JWT_SECRET` + `JWT_AUDIENCE`; modo `auth0` exige `JWKS_URI` + `IDP_AUDIENCE` + `IDP_ISSUER`. Se faltar, `throw` antes de `app.listen` (F7).

- [x] **T3.8** — Retornar 410 Gone em `POST /users/login` quando `AUTH_PROVIDER=local`
  - File: `apps/msgops-api/src/modules/users/users.controller.ts` (linhas ~22-41)
  - Action: no handler do `POST /users/login`, antes de qualquer lógica:
    ```ts
    if (this.config.get('AUTH_PROVIDER', 'local') === 'local') {
      throw new HttpException(
        'This endpoint is deprecated under AUTH_PROVIDER=local. Use POST /auth/login.',
        HttpStatus.GONE,
      );
    }
    ```
    Em modo `auth0`, handler continua executando como hoje.
  - Notes: injetar `ConfigService` no controller se não estiver. Decisão cravada (F19).

- [x] **T3.9** — Endurecer CORS para suportar cookie httpOnly cross-origin
  - File: `apps/msgops-api/src/cors.config.ts`
  - Action:
    - Em `createCorsOptions()` (linha 35): adicionar `credentials: true` no objeto retornado.
    - Em `isOriginAllowed()` (linha 19-33): quando `NODE_ENV === 'production'` E `credentials: true`, **rejeitar** `origin === undefined` (curl/health interno deve usar allowlist explícita via `CORS_ORIGINS` ou não passar por CORS). Deixar fallback dev permissivo.
    - Adicionar teste em `cors.config.spec.ts` para o comportamento novo.
  - Notes: sem `credentials: true`, o cookie `bms_refresh` é silenciosamente descartado pelo browser em cross-origin — ACs AC1/AC4/AC5/AC7/AC16 falham (F2).

#### Grupo 4 — Frontend Vue2

- [x] **T4.1** — Remover SDK Auth0 e ajustar deps
  - File: `apps/frontend-vue2/package.json`
  - Action: remover `@auth0/auth0-spa-js`. Rodar `pnpm install`.

- [x] **T4.2** — Reescrever plugin de auth
  - File: `apps/frontend-vue2/src/auth/auth.ts`
  - Action: substituir a inicialização do `createAuth0Client` pelo plugin local `authPlugin` que expõe em `Vue.prototype.$auth`: `{ login(email, password), logout(), getAccessToken(), isAuthenticated, user }`. Internamente usa `AuthService` (T4.3).
  - Remover `apps/frontend-vue2/src/auth/VueAuth.ts` (tudo).

- [x] **T4.3** — Reescrever `AuthService` (access token memory-only)
  - File: `apps/frontend-vue2/src/services/auth.service.ts`
  - Action: reescrever para falar com API local usando a instance Axios singleton criada em T4.4:
    ```ts
    let accessToken: string | null = null;
    let tokenExpiresAt = 0;
    export async function login(email, password) {
      const { data } = await api.post('/auth/login', { email, password }); // withCredentials=true globalmente
      accessToken = data.accessToken;
      tokenExpiresAt = Date.now() + data.expiresIn * 1000;
      await fetchMe();
    }
    export async function logout() {
      try {
        await api.post('/auth/logout');
      } finally {
        accessToken = null;
        tokenExpiresAt = 0;
        store.commit('clearUser');
      }
    }
    export async function getAccessToken() {
      if (accessToken && Date.now() < tokenExpiresAt - 30000) return accessToken; // 30s skew
      return refresh();
    }
    export async function refresh() {
      const { data } = await api.post('/auth/refresh');
      accessToken = data.accessToken;
      tokenExpiresAt = Date.now() + data.expiresIn * 1000;
      return accessToken;
    }
    export async function fetchMe() {
      const { data } = await api.get('/users/me');
      store.commit('setUser', data);
    }
    ```
  - Notes: access token **apenas em memória de módulo** — sem `sessionStorage`/`localStorage` (F20: proteção XSS). Hard reload da página perde o access token em memória, mas cookie `bms_refresh` sobrevive → `getAccessToken()` chama `refresh()` automaticamente. Se cookie também ausente, request 401 → interceptor de T4.4 força redirect para `/login`.

- [x] **T4.4** — Refatorar `ApiService` para instance singleton + interceptor 401
  - File: `apps/frontend-vue2/src/services/api.service.ts`
  - Action: **refactor estrutural** (não só adicionar interceptor): hoje `getApi()` cria uma axios instance nova a cada chamada (linhas 28-43) — incompatível com interceptor-based refresh. Passar a exportar uma **instance singleton** `api`:
    ```ts
    export const api = axios.create({
      baseURL: process.env.VUE_APP_API_URL,
      withCredentials: true, // cookie bms_refresh
    });
    // Request interceptor: anexa Authorization + Current-User em cada request
    api.interceptors.request.use(async (config) => {
      const token = await authService.getAccessToken().catch(() => null);
      if (token) config.headers.Authorization = `Bearer ${token}`;
      if (store.state.user)
        config.headers['Current-User'] = JSON.stringify({
          name: store.state.user.name,
          email: store.state.user.email,
        });
      return config;
    });
    // Response interceptor: 401 → refresh uma vez → retry mesma request via api (reusa interceptors)
    api.interceptors.response.use(null, async (error) => {
      const original = error.config;
      if (
        error.response?.status === 401 &&
        !original._retry &&
        !original.url.endsWith('/auth/refresh')
      ) {
        original._retry = true;
        try {
          await authService.refresh();
          return api(original);
        } catch {
          authService.logout();
          router.push('/login');
          throw error;
        }
      }
      throw error;
    });
    ```
    Manter `getApi()` export que retorna `api` para minimizar blast radius em callers.
  - Notes: `axios(error.config)` bare (bypass interceptors) **não funciona** — precisa reusar a instance `api` (F12).

- [x] **T4.5** — Simplificar `User.ts`
  - File: `apps/frontend-vue2/src/auth/User.ts`
  - Action: classe `User` passa a ser construída a partir do response de `GET /users/me` em vez de do ID token Auth0. Campos: `id`, `email`, `name`, `picture`, `providerId`, `roles`, `permissions`, `effectiveRole`. Remover split `sub` → `provider|id` se não for mais usado externamente.

- [x] **T4.6** — Atualizar guard
  - File: `apps/frontend-vue2/src/auth/guards/auth.guard.ts`
  - Action: de `authService.login()` (redirect Auth0) para `next({ name: 'login', query: { redirect: to.fullPath } })`. Se autenticado, `next()`.

- [x] **T4.7** — Criar `LoginPage.vue`
  - File: `apps/frontend-vue2/src/pages/login/LoginPage.vue`
  - Action: component com form email/senha, submit chama `this.$auth.login(email, password)`, em sucesso `this.$router.push(this.$route.query.redirect || '/')`, em erro exibe mensagem. Styling mínimo alinhado ao resto do app.

- [x] **T4.8** — Adicionar rota `/login` e ajustar `main.ts`
  - File: `apps/frontend-vue2/src/router.ts`
  - Action: adicionar `{ path: '/login', name: 'login', component: () => import('@/pages/login/LoginPage.vue'), meta: { public: true } }` no array de rotas.
  - File: `apps/frontend-vue2/src/main.ts`
  - Action: linhas ~159-166 — substituir `Vue.use(auth0Plugin, { domain, clientId, audience, ... })` por `Vue.use(authPlugin, { apiBaseUrl: process.env.VUE_APP_API_URL })`.

- [x] **T4.9** — Atualizar `.env.example` Vue2
  - File: `apps/frontend-vue2/.env.example`
  - Action: remover `VUE_APP_AUTH0_DOMAIN`, `VUE_APP_AUTH0_CLIENT_ID`, `VUE_APP_AUTH0_AUDIENCE`, `VUE_APP_AUTH0_ROLES_CLAIM`. **Manter** `VUE_APP_REDIRECT_MANAGER` (não é Auth0). Nenhuma env nova necessária (o login é via API — base URL já vem de `VUE_APP_API_URL`).

#### Grupo 5 — Frontend Vue3

- [x] **T5.1** — Remover SDK Auth0 e ajustar deps
  - File: `apps/msgops-manager-frontend/package.json`
  - Action: remover `@auth0/auth0-vue`. Rodar `pnpm install`.

- [x] **T5.2** — Criar composable `useAuth` drop-in
  - File: `apps/msgops-manager-frontend/src/composables/useAuth.ts`
  - Action: exportar `useAuth()` que retorna **shape compatível com `useAuth0()`**: `{ isAuthenticated: Ref<boolean>, isLoading: Ref<boolean>, user: Ref<User|null>, loginWithRedirect: (opts?) => void, logout: () => Promise<void>, getAccessTokenSilently: () => Promise<string> }`. `loginWithRedirect` faz `router.push({ name: 'login', query: { redirect: opts?.appState?.targetUrl } })`. Estado em Pinia (novo `useAuthStore` ou dentro de `useUserStore` existente).

- [x] **T5.3** — Refatorar `Auth.ts`
  - File: `apps/msgops-manager-frontend/src/infra/Auth/Auth.ts`
  - Action: substituir `createAuth0(...)` por simples config `{ apiBaseUrl: import.meta.env.VITE_API_MSGOPS }`. Remover export `auth0`.

- [x] **T5.4** — Atualizar `main.ts` Vue3
  - File: `apps/msgops-manager-frontend/src/main.ts`
  - Action: linha 18 (import `auth0`) e linha 51 (`app.use(auth0)`) — **remover**. Não precisa de plugin; composable basta.

- [x] **T5.5** — Atualizar `App.vue`
  - File: `apps/msgops-manager-frontend/src/App.vue`
  - Action:
    - Linha 4: `import { useAuth } from '@/composables/useAuth'`.
    - Linha 14: `const { isAuthenticated, isLoading, loginWithRedirect, user: authUser } = useAuth()`.
    - Linhas 31-45: o watch atual chama `POST /users/login` com dados do Auth0 ID token; trocar para: quando `isAuthenticated` virar true, chamar `userHttpGateway.getMe()` (já existe provavelmente; senão criar) e popular `userStore`. Remover o `POST /users/login` (legacy Auth0 bootstrap).

- [x] **T5.6** — Atualizar `router.ts` Vue3 (remover Auth0 + adicionar /login + guard local)
  - File: `apps/msgops-manager-frontend/src/router.ts`
  - Action: cobertura geral do arquivo; refatoração específica de `BILLING_ONLY_ROLE` fica em T5.15.
    - Remover import `auth0` (linha 4).
    - Remover linha 11 (`ROLES_CLAIM`).
    - Remover rota `/callback`.
    - Adicionar rota `/login` → `LoginPage.vue` (T5.8) com `meta: { public: true }`.
    - Guard `beforeEach`: remover `auth0.checkSession()`. Nova lógica — se rota não é `public` e `!userStore.isAuthenticated`, `next({ name: 'login', query: { redirect: to.fullPath } })`. Se autenticado e store vazio, `await userHttpGateway.getMe(accountId); userStore.setUser(response);`. Checks de role ficam para T5.15.

- [x] **T5.7** — Atualizar `BmsHeader.vue`
  - File: `apps/msgops-manager-frontend/src/components/BmsHeader.vue`
  - Action: trocar `import { useAuth0 } from '@auth0/auth0-vue'` → `import { useAuth } from '@/composables/useAuth'`. O resto (`logout()`, `isAuthenticated`, `user`) funciona igual via drop-in.

- [x] **T5.8** — Criar `LoginPage.vue` Vue3
  - File: `apps/msgops-manager-frontend/src/pages/Login/LoginPage.vue`
  - Action: component Vue 3 + `<script setup>` com form email/senha. Submit chama gateway `loginHttpGateway.login({ email, password })` (T5.9) → em sucesso, setar `userStore`, `router.push(route.query.redirect || '/dashboard')`. Tratar erro 401 com mensagem amigável.

- [x] **T5.9** — Criar/atualizar gateway HTTP de auth
  - File: `apps/msgops-manager-frontend/src/gateways/Auth/AuthHttpGateway.ts` (novo)
  - Action: métodos `login({ email, password })` → `POST /auth/login` (com `withCredentials: true`); `refresh()` → `POST /auth/refresh`; `logout()` → `POST /auth/logout`; `getMe()` → `GET /users/me`. Usar instância Axios que já existe no projeto (padrão `src/gateways`).

- [x] **T5.10** — Criar novo `authGuard` local
  - File: `apps/msgops-manager-frontend/src/router/guards/authGuard.ts` (novo)
  - Action: função `authGuard: NavigationGuard` que verifica `userStore.isAuthenticated` (ou checa existência de access token em memória). Se não, `next({ name: 'login', query: { redirect: to.fullPath } })`.

- [x] **T5.11** — Substituir import de `authGuard` em 7 páginas
  - Files:
    - `apps/msgops-manager-frontend/src/pages/Users/UsersPage/index.ts`
    - `apps/msgops-manager-frontend/src/pages/Billing/BillingPage/index.ts`
    - `apps/msgops-manager-frontend/src/pages/Accounts/AccountsPage/index.ts`
    - `apps/msgops-manager-frontend/src/pages/Accounts/AccountCreatePage/index.ts`
    - `apps/msgops-manager-frontend/src/pages/Accounts/AccountEditPage/index.ts`
    - `apps/msgops-manager-frontend/src/pages/Users/UserCreatePage/index.ts`
    - `apps/msgops-manager-frontend/src/pages/Users/UserEditPage/index.ts`
  - Action: em cada um, trocar `import { authGuard } from '@auth0/auth0-vue'` por `import { authGuard } from '@/router/guards/authGuard'`.

- [x] **T5.12** — Atualizar store com role codes DB + flags explícitas
  - File: `apps/msgops-manager-frontend/src/stores/Users/useUserStore.ts`
  - Action: `setRoles(roles: string[])` mantido. Adicionar state: `effectiveRole: string | null`, `isSuperAdmin: boolean`, `canSeeAllAccounts: boolean`, `permissions: string[]`. Em `setUser(me)` ou equivalente, popular todos os campos a partir do response de `GET /users/me`.
  - **Nenhuma virtual role injetada** — `userStore.roles` contém apenas role codes reais do DB.

- [x] **T5.13** — Atualizar `.env.example` Vue3
  - File: `apps/msgops-manager-frontend/.env.example`
  - Action: remover `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `VITE_AUTH0_CALLBACK_URL`, `VITE_AUTH0_ROLES_CLAIM`, `VITE_AUTH0_BILLING_ONLY_ROLE`. Manter `VITE_API_MSGOPS`.

- [x] **T5.14** — Refatorar `BillingPage.vue:167` para ler flag `canSeeAllAccounts`
  - File: `apps/msgops-manager-frontend/src/pages/Billing/BillingPage/BillingPage.vue`
  - Action: linha 167 — substituir `if (userStore.roles.includes('etus_superbilling'))` por `if (userStore.canSeeAllAccounts)`. Fonte da flag: backend emite em `/users/me` como `canSeeAllAccounts: boolean = isSuperAdmin || effectiveRole === 'billing'` (T3.4).
  - Notes: preserva semântica atual (role `billing` + super_admin veem todas contas) sem acoplamento a string Auth0 legada (F4).

- [x] **T5.15** — Refatorar `router.ts:11-28` Vue3 para eliminar BILLING_ONLY_ROLE
  - File: `apps/msgops-manager-frontend/src/router.ts`
  - Action:
    - Remover linhas 11-12 (`ROLES_CLAIM`, `BILLING_ONLY_ROLE`).
    - No guard `beforeEach` (linhas 14-32), substituir `if (userStore.roles.includes(BILLING_ONLY_ROLE))` por `if (userStore.effectiveRole === 'billing' && !userStore.isSuperAdmin)` (super_admin não deve ser trapped em `/billing`).
    - Remover `auth0.checkSession()`. Guard passa a: se `!userStore.isAuthenticated`, redirect `/login`; caso contrário, se `!userStore.effectiveRole` (store vazio), `await userHttpGateway.getMe(accountId); userStore.setUser(response);`. Rota `/callback` removida.
  - Notes: `superbilling` Auth0 (billing-only viewer) não é o mesmo que role `billing` do DB — não portar em V0.1 (F4).

- [x] **T5.16** — Auditar `BmsSidebar.vue` `hideFromRoles`
  - File: `apps/msgops-manager-frontend/src/components/BmsSidebar/BmsSidebar.vue`
  - Action: inspecionar a fonte dos itens do sidebar (onde `item.hideFromRoles` é populado, provavelmente em `src/components/BmsSidebar/items.ts` ou similar) e garantir que os valores são role codes do DB (`super_admin`, `admin`, `editor`, `analyst`, `support`, `billing`) — nada de strings Auth0 legadas (`superbilling`, `etus_superbilling`). Substituir onde necessário. Linha 27 (`item.hideFromRoles.some((role) => userStore.roles.includes(role))`) fica inalterada.

#### Grupo 6 — Docs

- [x] **T6.1** — Atualizar `CLAUDE.md` raiz
  - File: `CLAUDE.md`
  - Action:
    - Linha ~14: substituir `Auth0 (frontend: @auth0/nextjs-auth0, backend: passport-jwt + JWKS)` por `Pluggable auth via IAuthProvider — default LocalAuthProvider (JWT HS256 + bcrypt); Auth0AuthProvider opcional via AUTH_PROVIDER=auth0`.
    - Linhas 70, 90, 91: corrigir `backoffice-api` → `msgops-api`, `@auth0/nextjs-auth0` → `@auth0/auth0-vue` / `@auth0/auth0-spa-js`, "App Router integration" → "Vue 3 / Vue 2 SPAs".
    - Se houver seção sobre frontend stack que mencione `@auth0/*` — ajustar.

- [x] **T6.2** — Atualizar `README.md` raiz
  - File: `README.md`
  - Action: seção "Auth" da tabela de stack → `Local (default) / Auth0 (optional)`. Remover `Auth0 tenant configured` dos prerequisites. Remover `AUTH0_SECRET` / `AUTH0_CLIENT_SECRET` do exemplo `gcloud ... --set-secrets`. Adicionar nota: "Para OSS self-hosted, `AUTH_PROVIDER=local` é o default. Set `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` antes do primeiro boot."

- [x] **T6.3** — Atualizar `README.md` do msgops-manager-frontend
  - File: `apps/msgops-manager-frontend/README.md`
  - Action: seção Auth → descrever fluxo local + composable `useAuth`. Remover linhas 11, 30-33 que falam de `@auth0/auth0-vue` e envs Auth0. Adicionar envs novos (se houver).

#### Grupo 7 — Testes

- [x] **T7.1** — Unit tests `LocalAuthProvider`
  - File: `apps/msgops-api/src/modules/auth/providers/local-auth.provider.spec.ts` (novo)
  - Action: cobrir `createUser` (gera providerId `local|...`, hash correto), `login` (credencial válida gera tokens; senha errada → UnauthorizedException; user não existe → UnauthorizedException), `refresh` (rotação: token velho fica revogado, novo funciona; token revogado rejeitado; expirado rejeitado), `logout` (idempotente), `verifyToken` (HS256 válido; alg errado rejeitado; expirado rejeitado; assinatura errada rejeitada), `updatePassword` (credencial atualizada).

- [x] **T7.2** — Integration test `AuthController` (seguindo padrão existente)
  - File: `apps/msgops-api/tests/e2e/auth.e2e-spec.ts` (**path correto**: plural `tests/`, subfolder `e2e/` — F10)
  - Action: seguir o padrão de `apps/msgops-api/tests/e2e/accounts.e2e-spec.ts` (único e2e atual). Setup usa `jest-setup.ts` e config `tests/e2e/jest-e2e.json`. Fluxo:
    1. Subir Nest test app com `AUTH_PROVIDER=local`, DB de teste com migrations aplicadas.
    2. Rodar `seedAdmin` manualmente com credenciais fixas.
    3. `POST /auth/login { email, password }` → 200 + access token + cookie `bms_refresh`.
    4. `GET /users/me` com Bearer → 200.
    5. `POST /auth/refresh` com cookie → 200 + novo token + novo cookie.
    6. `POST /auth/logout` com novo cookie → 200.
    7. `POST /auth/refresh` com cookie antigo (pre-rotação OU pós-logout) → 401.
  - Notes: se não houver testcontainers ainda no projeto, **não introduzir** nessa quick spec — usar o mesmo setup de DB que `accounts.e2e-spec.ts` usa hoje. Se aquele padrão for insuficiente, reduzir T7.2 a smoke manual documentado em Testing Strategy.

- [x] **T7.3** — Test para seed admin
  - File: `apps/msgops-api/src/bootstrap/seed-admin.spec.ts` (novo)
  - Action: DB vazia + envs presentes → cria admin; DB não-vazia → skip silencioso; DB vazia + envs ausentes → throw.

- [x] **T7.4** — Compatibility test modo `auth0`
  - Action: rodar suite existente com `AUTH_PROVIDER=auth0` e JWKS_URI apontando para tenant Auth0 de teste → `PermissionGuard.spec.ts` continua passando. Documentar como configurar em CI (ou deixar behind flag).

- [x] **T7.5** — Frontend Vue2 — service tests
  - File: `apps/frontend-vue2/src/services/auth.service.spec.ts` (novo ou atualizado)
  - Action: mockar axios. Testar `login`, `logout`, `refresh`, interceptor 401-retry.

- [x] **T7.6** — Frontend Vue3 — composable tests
  - File: `apps/msgops-manager-frontend/src/composables/useAuth.spec.ts` (novo)
  - Action: Vitest com mock do `AuthHttpGateway`. Testar shape compatível com `useAuth0` (isAuthenticated, user, login, logout).

- [x] **T7.7** — Integration test: race condition de bootstrap admin
  - File: `apps/msgops-api/tests/e2e/seed-admin-race.e2e-spec.ts` (novo)
  - Action: simular duas chamadas concorrentes a `seedAdmin(dataSource, config, logger)` usando `Promise.all`. Verificar que exatamente 1 `UserEntity` admin existe no final e apenas 1 das chamadas logou "Bootstrap admin created" (outra logou "skipped" ou retornou silenciosamente após perceber row já inserida). Cobre AC21 (F5).

- [x] **T7.8** — Integration test: cache invalidation on logout
  - File: `apps/msgops-api/tests/e2e/auth-cache-invalidation.e2e-spec.ts` (novo)
  - Action: login → `GET /users/me` (warm cache) → inspecionar Redis key `authz:user:<providerId>:default` existe → `POST /auth/logout` → verificar key não existe mais. Cobre AC23 (F14).

### Acceptance Criteria

- [ ] **AC1 (happy path login):** Given `AUTH_PROVIDER=local`, bootstrap admin criado com `BOOTSTRAP_ADMIN_EMAIL=admin@acme.com`, When o frontend Vue3 faz `POST /auth/login { email: 'admin@acme.com', password: <correto> }`, Then recebe status 200 com `{ accessToken, expiresIn, user }` e cookie `bms_refresh` httpOnly.

- [ ] **AC2 (acesso protegido):** Given usuário autenticado (AC1), When faz `GET /users/me` com `Authorization: Bearer <accessToken>`, Then recebe 200 com `{ ..., role, effectiveRole, permissions: string[], roles: string[] }` e `roles` contém `'super_admin'` quando o seed é super admin.

- [ ] **AC3 (role codes DB + flag explícita):** Given usuário com `effectiveRole='billing'`, When chama `GET /users/me`, Then `response.roles` contém `'billing'` (código real do DB), `response.effectiveRole === 'billing'`, `response.canSeeAllAccounts === true`. **NÃO** contém `'superbilling'` ou `'etus_superbilling'` (não são virtual roles).

- [ ] **AC4 (refresh rotação):** Given usuário autenticado com cookie válido, When faz `POST /auth/refresh`, Then recebe novo `accessToken` + novo cookie rotacionado, e o cookie anterior passa a retornar 401 em chamadas futuras.

- [ ] **AC5 (logout):** Given usuário autenticado, When faz `POST /auth/logout`, Then o cookie é limpo no response e o refresh token anterior rejeitado em `POST /auth/refresh` subsequente (status 401).

- [ ] **AC6 (login senha errada):** Given admin seedado, When `POST /auth/login` com senha incorreta, Then status 401 com mensagem genérica (não revela se email existe).

- [ ] **AC7 (token access expirado → refresh automático no Vue2):** Given access token expirado na memória do frontend-vue2, When o app faz uma request a endpoint protegido, Then o interceptor 401 chama `POST /auth/refresh`, obtém novo token via cookie httpOnly, refaz a request original com sucesso (usando a mesma axios instance para reaplicar interceptors) — sem intervenção do usuário.

- [ ] **AC7b (hard reload restaura sessão):** Given usuário autenticado com cookie `bms_refresh` válido e access token apenas em memória, When executa hard reload da página (F5/Ctrl+Shift+R), Then primeira request protegida dispara `POST /auth/refresh` silencioso usando o cookie, obtém novo access token, e o usuário permanece logado. Se o cookie foi expirado OU o cookie foi revogado, redirect para `/login`.

- [ ] **AC8 (guard redirect sem login):** Given usuário não autenticado, When navega para rota protegida no Vue3 (ex.: `/users`), Then é redirecionado para `/login?redirect=/users`.

- [ ] **AC9 (drop-in Vue3 sem regressão UI):** Given composable `useAuth` em uso em `App.vue` e `BmsHeader.vue`, When o app roda, Then comportamento visível (exibição do nome do usuário, botão logout, sidebar filtrada por roles) é idêntico ao anterior com Auth0.

- [ ] **AC10 (bootstrap idempotente):** Given tabela `users` com pelo menos 1 registro não-deletado, When o `msgops-api` inicia com `AUTH_PROVIDER=local`, Then o seed é skipped (log "Bootstrap admin: skipped") e nenhum insert em `users` ocorre.

- [ ] **AC11 (bootstrap fail-fast):** Given tabela `users` vazia e `BOOTSTRAP_ADMIN_PASSWORD` ausente, When o `msgops-api` inicia com `AUTH_PROVIDER=local`, Then o boot falha com erro claro ("Empty users table requires BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD envs").

- [ ] **AC11b (bootstrap senha fraca rejeitada):** Given tabela `users` vazia e `BOOTSTRAP_ADMIN_PASSWORD='admin'` (< 8 chars), When o `msgops-api` inicia com `AUTH_PROVIDER=local`, Then o boot falha com "BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters" — evita admin locked-out por DTO min-length mismatch (F16).

- [ ] **AC12 (compatibilidade Auth0):** Given `AUTH_PROVIDER=auth0` e envs `AUTH0_*` / `JWKS_URI` / `IDP_AUDIENCE` / `IDP_ISSUER` configuradas, When o app inicia e recebe um JWT Auth0 válido no header, Then `PrincipalContextGuard` resolve o usuário normalmente e guards `@RequirePermission` continuam enforçando — sem regressão de comportamento para chamadas autenticadas. **Nota:** em modo `auth0`, `POST /auth/login|refresh|logout` **não existem** (404) porque `AuthController` é registrado condicionalmente (T2.6 / F11). Frontends conectados a um backend em modo `auth0` precisam estar configurados para usar o fluxo Auth0 — isso é decisão de deployment, não bug.

- [ ] **AC13 (criação de usuário via invite):** Given admin autenticado (modo local), When chama `POST /users/invite { email, name, password }`, Then `UsersService` chama `authProvider.createUser(...)` → `LocalAuthProvider` cria `UserEntity` com `provider_id='local|<uuid>'` + `UserCredentialsEntity` com hash bcrypt. Resposta sucesso com user criado.

- [ ] **AC14 (atualização de senha admin):** Given admin autenticado, When chama `PUT /users/update-password/:id`, Then `authProvider.updatePassword(providerId, password)` é invocado; em modo local, `user_credentials` é atualizado; em modo auth0, Management Client é chamado (comportamento atual).

- [ ] **AC15 (sem leitura de custom claim):** Given frontend Vue3 rodando contra modo local, When um usuário faz login, Then nenhuma leitura de `auth0.user.value[ROLES_CLAIM]` ocorre; roles são lidos exclusivamente via `GET /users/me`.

- [ ] **AC16 (cookie httpOnly + SameSite + Path=/):** Given response de `POST /auth/login`, When inspecionado, Then cookie `bms_refresh` tem `httpOnly=true`, `sameSite=Lax`, **`path=/`** (não `/auth`), e `secure=true` quando `NODE_ENV=production`. Cookie também é enviado pelo browser em `POST /auth/refresh` e `POST /auth/logout`, mesmo se backend estiver atrás de reverse proxy com prefix (F1).

- [ ] **AC17 (JWKS URI removida):** Given `AUTH_PROVIDER=local`, When o app inicia, Then NÃO faz nenhuma requisição a `JWKS_URI` (verificável via network mock ou log).

- [ ] **AC18 (RBAC preservado):** Given migration de RBAC executada e usuário com role `editor`, When chama endpoint com `@RequirePermission('campaigns:create')`, Then passa (editor tem essa permissão) — mesmo comportamento pré-mudança.

- [ ] **AC19 (refresh token reuso logado):** Given refresh token foi rotacionado (usado em `POST /auth/refresh`), When o mesmo refresh token é reapresentado, Then response é 401 **E** é emitido log estruturado `{ event: 'refresh_token_reuse_detected', tokenHash, userAgent, ip, timestamp }` no nível `warn`. Operador consegue correlacionar esses logs para detectar comprometimento (revogação de família avançada fica como future work — F15).

- [ ] **AC20 (migrations reversíveis):** Given migrations `user_credentials` e `user_refresh_tokens` aplicadas, When rodar `typeorm migration:revert` duas vezes, Then as tabelas são dropadas sem erro e o schema volta ao estado pré-migração.

- [ ] **AC21 (bootstrap race multi-instância):** Given tabela `users` vazia e 2+ instâncias do `msgops-api` iniciando concorrentemente com `AUTH_PROVIDER=local`, When todas chamam `seedAdmin`, Then **exatamente 1** admin é criado (via `pg_advisory_xact_lock`), nenhuma instância falha com UNIQUE constraint, e apenas 1 log "Bootstrap admin created" é emitido — outras logam "skipped". (F5)

- [ ] **AC22 (`POST /users/login` em modo local):** Given `AUTH_PROVIDER=local`, When client faz `POST /users/login` com um Auth0 JWT no Authorization header, Then response é `410 Gone` com body `{ message: 'This endpoint is deprecated under AUTH_PROVIDER=local. Use POST /auth/login.' }`. **Em modo `auth0`**, o endpoint continua funcionando (lazy-create como hoje). (F19)

- [ ] **AC23 (logout invalida cache AuthzService):** Given usuário autenticado e `GET /users/me` executado (warm cache Redis em `authz:user:<providerId>:default`), When `POST /auth/logout` é chamado, Then a key do Redis correspondente é removida dentro de 1 request (sem aguardar TTL de 5 min). Request subsequente usando o access token ainda não expirado encontra cache vazio e reexecuta o lookup do `UserEntity`. (F14)

- [ ] **AC24 (CORS permite cookie cross-origin):** Given frontend em origem permitida (`CORS_ORIGINS` ou `CORS_CF_PAGES_PROJECT` match), When faz `OPTIONS /auth/login` seguido de `POST /auth/login` com `credentials: 'include'`, Then preflight retorna `Access-Control-Allow-Credentials: true` e `Access-Control-Allow-Origin: <origin específico>` (não `*`); cookie `bms_refresh` é aceito pelo browser e enviado em requests subsequentes cross-origin. (F2)

- [ ] **AC25 (LocalAuthProvider.updatePassword rejeita não-local providers):** Given `AUTH_PROVIDER=local` e user com `provider_id='auth0|xxx'` (legado), When admin chama `PUT /users/:id/update-password`, Then `LocalAuthProvider.updatePassword` lança `BadRequestException('LocalAuthProvider cannot update non-local provider user')` — evita criar credentials silenciosas para user Auth0 legado (F18).

## Additional Context

### Dependencies

**Runtime (adicionar ao `apps/msgops-api/package.json`):**

- `bcrypt@^5.1.1` + `@types/bcrypt@^5.0.2` (**ausentes hoje**)
- `uuid@^9.0.0` + `@types/uuid@^9.0.0` (**ausentes hoje**)
- `cookie-parser` — **JÁ instalado**, `package.json:50`. Não re-adicionar.

**Runtime (remover dos frontends):**

- `apps/frontend-vue2/package.json`: `@auth0/auth0-spa-js`
- `apps/msgops-manager-frontend/package.json`: `@auth0/auth0-vue`

**Runtime (remover do backend se T3.3 deletar JwtStrategy):**

- `passport`, `passport-jwt` — avaliar se nada mais usa Passport após deleção.

**Mantidas (para `Auth0AuthProvider`):**

- `apps/msgops-api`: `auth0@^5.4.0`, `@types/auth0`, `jwks-rsa`, `jsonwebtoken`.

**Infraestrutura:**

- Postgres: migrations novas aplicadas antes do primeiro boot em modo `local`.
- Secret generation: `openssl rand -hex 32` para `JWT_SECRET` — documentar no README.
- **CORS: INCLUÍDO no escopo** (T3.9) — `credentials: true` é requisito funcional para o cookie httpOnly cross-origin, não opcional. Sem isso, AC1/AC4/AC5/AC7/AC16/AC24 falham.

**Outras tasks/features:**

- Nenhuma dependência de outras tasks em andamento identificada. Pode rodar em paralelo com qualquer trabalho que não toque em `users.service.ts`, `authz.service.ts`, `main.ts` do `msgops-api`, ou nos arquivos de auth dos frontends.

### Testing Strategy

**Unit (backend) — Jest:**

- `LocalAuthProvider` spec completa (T7.1).
- `seed-admin` spec (T7.3).
- `Auth0AuthProvider` spec smoke (garantir que o refactor não quebrou a interface pública).
- `AuthzService.verifyJwtToken` — mockar `IAuthProvider.verifyToken` e garantir delegação correta.

**Integration (backend) — Jest + supertest, seguindo padrão de `tests/e2e/accounts.e2e-spec.ts`:**

- `AuthController` end-to-end: login → me → refresh → logout (T7.2). Path correto: `apps/msgops-api/tests/e2e/auth.e2e-spec.ts` (plural `tests/`, subfolder `e2e/`).
- Bootstrap admin race multi-instância (T7.7): `Promise.all([seedAdmin(...), seedAdmin(...)])` → exatamente 1 admin criado.
- Cache invalidation on logout (T7.8): inspecionar Redis key antes/depois de logout.
- Compatibilidade: rodar smoke com `AUTH_PROVIDER=auth0` se houver tenant de teste (T7.4) — se não, rodar apenas unit test de `Auth0AuthProvider` mockando HTTP calls.
- **Infra de teste:** usar o mesmo setup de DB do `accounts.e2e-spec.ts` (sem introduzir testcontainers nessa quick spec). Se o padrão atual for insuficiente para DB fresh-per-test, reduzir T7.2 a smoke manual.

**Unit (frontend Vue2) — Jest:**

- `AuthService` (T7.5): login sucesso/falha, refresh, logout, interceptor 401.

**Unit (frontend Vue3) — Vitest:**

- `useAuth` composable (T7.6): shape drop-in + estados.
- `authGuard` novo: redireciona quando não autenticado, passa quando autenticado.

**Manual / Smoke:**

1. `AUTH_PROVIDER=local` + `BOOTSTRAP_ADMIN_*` setados → subir `msgops-api` → verificar log `Bootstrap admin created`.
2. Subir `msgops-manager-frontend` dev → navegar `/users` → redirect para `/login` → submeter credenciais → redirect para página original, navegação funciona.
3. Idem no `frontend-vue2` (testar também feature que depende de `Current-User` header).
4. Esperar expiração do access token (`JWT_ACCESS_TTL=60` para teste) → fazer uma request → observar refresh automático no devtools network.
5. Logout → tentar reusar o cookie (copiado antes do logout) → 401.
6. Trocar para `AUTH_PROVIDER=auth0` (envs Auth0 configuradas) → smoke que o fluxo Auth0 existente continua funcionando sem regressão.

### Notes

**High-risk / pre-mortem:**

1. **Condição de corrida na rotação de refresh:** duas requests paralelas de `/auth/refresh` com o mesmo cookie podem rotacionar 2× e uma ficar órfã. Mitigação: `UPDATE user_refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW() RETURNING *` — só a primeira UPDATE retorna linha; a segunda vê 0 linhas e falha com 401 + log estruturado de reuso (T2.2).

2. **`POST /users/login` legacy:** em modo `local` retorna **410 Gone** com mensagem clara apontando `POST /auth/login` (T3.8 / AC22). Decisão cravada.

3. **~~Virtual roles~~ — REMOVIDO:** a proposta inicial de emitir `superbilling`/`etus_superbilling` via `/users/me` foi descartada. São user-types Auth0 distintos (F4) — `superbilling` travava `/users` e `/accounts` redirect; `etus_superbilling` dava cross-tenant visibility. Conflar era regressão de privilégio. Agora: frontend lê `effectiveRole` + `canSeeAllAccounts` explicitamente (T3.4 / T5.14 / T5.15).

4. **CORS + credentials — AGORA IN SCOPE (T3.9):** sem `credentials: true` no backend CORS, o cookie `bms_refresh` é silenciosamente descartado pelo browser em cross-origin — todos os ACs de sessão falham.

5. **`JWT_SECRET` em `.env`:** para OSS self-hosted, `.env` é aceitável. Para deploys SaaS em produção, usar secret manager (GCP Secret Manager). Documentar no `README.md` raiz como parte da T6.2.

6. **~~Remoção de `passport-jwt` / `JwtStrategy`~~ — DECIDIDO:** T3.3 crava deleção. Grep confirmou zero `@UseGuards(AuthGuard('jwt'))` no repo. Deps `passport` e `passport-jwt` saem do `package.json` junto com os arquivos.

7. **Compatibilidade de usuários Auth0 pré-existentes (modo híbrido):** em modo `local` com users legados Auth0 ainda no DB, `LocalAuthProvider.updatePassword` **rejeita** providerId não-`local|` via `BadRequestException` (T2.2 / AC25). Migração Auth0 → Local fica como script pós-v0.1 (reinvite).

8. **Cache Redis e logout:** AuthzService cacheia `PrincipalContext` por 5 min. `LocalAuthProvider.logout` e `updatePassword` invocam `authzService.invalidateUserCache(providerId)` para que logout seja imediato em vez de delayed 5 min (F14 / AC23 / T7.8).

9. **Cookie `Path=/` vs reverse proxy:** decidido `Path=/` (não `/auth`) para funcionar sob qualquer mount prefix (ex.: `api.example.com/api/auth/...`). Tradeoff: cookie é enviado em qualquer path mesmo quando não necessário, mas ele é opaco + httpOnly + curto (~60 bytes), impacto de header bloat negligível (F1).

10. **Dual-stack (local + auth0) em deploys híbridos:** se um adopter rodar duas instâncias (uma local, outra auth0) contra o mesmo DB, os providers podem colidir (user com `auth0|...` não existe em `user_credentials`). Não suportado em V0.1 — deployment deve escolher 1 provider.

**Known limitations:**

- Sem rate limiting em `/auth/login` — abre para brute force. Mitigação V0.1: confiar em camada de infra (WAF / Cloudflare). Criar issue "Rate limit auth endpoints".
- Sem tela de "esqueci minha senha" — admin reset apenas.
- Sem multi-session management UI — usuário não vê lista de sessions ativas.
- Sem revogação de access tokens (só refresh). Access token compromisso dura até `JWT_ACCESS_TTL` (default 1h). Aceitável p/ V0.1. Logout derruba o cache `AuthzService`, mas o token em si continua aceito por guards até expirar.
- `user_refresh_tokens` não tem cleanup automático — tabela cresce indefinidamente. Job cron pós-v0.1 (`DELETE WHERE expires_at < NOW() OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')`).
- Hybrid mode (local + auth0 simultâneos) não suportado.

**Future work (explicitamente fora):**

- Forgot password por email (v0.2).
- MFA (TOTP/WebAuthn).
- Login social (Google/GitHub via OAuth2 direto, não Auth0).
- Rate limit + lockout.
- Migration tool Auth0 → Local.
- Session management UI.
- Detecção avançada de refresh token reuse (revogar família inteira).

**Contexto da discovery preservado:**

- Inventário Auth0 levantado em duas rodadas de `Explore`. Principais achados consolidados em "Files to Reference" e "Technical Decisions".

### Review Follow-ups (AI) — 2026-04-24

Adversarial review rodado em 2026-04-24. 4 HIGH e 7 MEDIUM encontrados; todos corrigidos nesta passada.

- [x] **[AI-Review][H1]** Write 6 missing test files claimed `[x]` but not on disk — `tests/e2e/auth.e2e-spec.ts`, `tests/e2e/seed-admin-race.e2e-spec.ts`, `tests/e2e/auth-cache-invalidation.e2e-spec.ts`, `src/bootstrap/seed-admin.spec.ts`, `apps/frontend-vue2/src/services/auth.service.spec.ts`, `apps/msgops-manager-frontend/src/composables/useAuth.spec.ts`.
- [x] **[AI-Review][H2]** Add `refresh` / `logout` coverage to `local-auth.provider.spec.ts` (T7.1 had only 5 of 7 methods).
- [x] **[AI-Review][H3]** `LocalAuthProvider.refresh` was logging `refresh_token_reuse_detected` for expired-but-never-revoked tokens. Fixed: only log when `existed.revokedAt != null`. Regression test added.
- [x] **[AI-Review][H4]** `AuthModule` reads `process.env.AUTH_PROVIDER` at import-time, before `main.ts:15` ran `dotenv.config()`. Extracted a `src/env-loader.ts` imported first in `main.ts` so `.env`-driven provider selection actually works.
- [x] **[AI-Review][M1]** `LocalAuthProvider.createUser` is a no-op by design (persistence owned by `UsersService.create`). Added explicit doc comment calling out the follow-up `updatePassword` contract so the next contributor doesn't create users without credentials.
- [x] **[AI-Review][M3]** `seedAdmin` now logs the same normalized email it stored (not the raw envvar).
- [x] **[AI-Review][M4]** `assertProviderMatches` error message now names the actual provider prefix and tells the operator to reinvite.
- [x] **[AI-Review][M5]** Added `timestamp` to the `refresh_token_reuse_detected` log payload (AC19 literal spec).
- [ ] **[AI-Review][M2]** `router.ts` Vue3 redirects non-super-admins to `VITE_APP_REDIRECT_MSGOPS` — legitimate product decision but not documented in T5.6/T5.15. **Action:** add this to the Linear card description or a follow-up spec note before release notes go out. Not a code change.
- [ ] **[AI-Review][M6]** `useAuth.ts` calls `axios` bare (not the `api` singleton). Intentional for auth endpoints; `bootstrapAuth`'s GET `/users/me` could benefit from interceptor but impact is negligible. **Action:** leave as-is for v0.1; revisit if session instability shows up.
- [ ] **[AI-Review][M7]** `setLoadAuth0` / `loadAuth0` store key in Vue2 carries Auth0 residue in naming despite anti-Auth0 fluxo. **Action:** rename to `authReady` in a follow-up PR (not blocking).
- [ ] **[AI-Review][L1]** Add `@ApiBody` / `@ApiResponse` annotations to `AuthController` handlers so Swagger shows login/refresh/logout schemas. Nice-to-have.
- [ ] **[AI-Review][L2]** Document `X-Forwarded-For` trust assumption in deployment notes — only trustworthy behind a reverse proxy that sanitizes the header.
- [ ] **[AI-Review][L3]** PR #7 bundles local-auth with `fef3e62` (vuetify install fix) and `adcd267` (isInternal account toggle). **Action:** call this out in the PR description so the reviewer knows scope creep is intentional.

Unit/integration test runs after fixes:

- `apps/msgops-api`: 214 tests / 14 suites passing (inclui +12 novos em `local-auth.provider.spec.ts` e `seed-admin.spec.ts`).
- `apps/msgops-manager-frontend`: 24 tests / 4 suites passing (inclui +6 novos em `useAuth.spec.ts`).
- `apps/frontend-vue2`: 8 tests / 1 suite passing (primeiro jest spec do app — adicionado `tsconfig.jest.json` + `moduleNameMapper` para desbloquear).
- E2E skeletons (`auth.e2e-spec.ts`, `seed-admin-race.e2e-spec.ts`, `auth-cache-invalidation.e2e-spec.ts`) requerem DB + Redis de teste e rodam via `pnpm --filter msgops-api test:e2e`.
- CLAUDE.md da raiz menciona `@auth0/nextjs-auth0` e `apps/backoffice-api` — **referências desatualizadas**, corrigidas como parte deste spec (T6.1).
