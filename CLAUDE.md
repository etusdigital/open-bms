# BMS Open Source

## Overview

Messaging operations platform (BMS) for multi-channel campaigns — email, SMS, push, WhatsApp. Monorepo with NestJS backend, two Vue frontends, and supporting workers.

## Architecture

- **Monorepo**: Turborepo + pnpm
- **Frontends**:
  - `apps/frontend-vue2` — Vue 2 SPA (operator workspace, Vuex, axios)
  - `apps/msgops-manager-frontend` — Vue 3 SPA (admin/manager, Pinia, Vite)
- **Backend** (`apps/msgops-api`): NestJS — REST API + TypeORM (PostgreSQL) + Redis
- **Workers**: `event-process`, `send-email`, `campaign-packer`, etc. (separate Nest/Node apps)
- **Operational DB**: PostgreSQL via TypeORM (`apps/msgops-api/src/entities/*.entity.ts`)
- **Analytics**: ClickHouse (separate deployment, consumed by workers)
- **Auth**: Pluggable via `IAuthProvider` — default `LocalAuthProvider` (JWT HS256 + bcrypt); `Auth0AuthProvider` opcional via `AUTH_PROVIDER=auth0`

## Key Commands

```bash
pnpm install          # Install all dependencies
pnpm dev              # Dev all apps
pnpm build            # Build all apps
pnpm type-check       # TypeScript check
```

### Per-app commands

```bash
# Backend (apps/msgops-api)
pnpm --filter msgops-api dev

# Frontend Vue 2 (apps/frontend-vue2)
pnpm --filter msg-ops serve

# Frontend Vue 3 (apps/msgops-manager-frontend)
pnpm --filter msgops-manager-frontend dev
```

## Project Structure

```
apps/
  msgops-api/              # NestJS — REST API (auth, users, campaigns, messaging)
  frontend-vue2/           # Vue 2 SPA (operator workspace)
  msgops-manager-frontend/ # Vue 3 SPA (admin/manager)
  event-process/           # Workers: event processing, send-email, etc.
  ...
packages/
  typescript-config/
  eslint-config/
```

## Conventions

- **Auth**:
  - Default mode: `AUTH_PROVIDER=local` → `LocalAuthProvider` emite JWT HS256 assinado com `JWT_SECRET`, bcrypt 12 rounds, refresh opaco (UUID) em cookie httpOnly.
  - Auth0: `AUTH_PROVIDER=auth0` com `AUTH0_DOMAIN`/`AUTH0_CLIENT_ID`/`AUTH0_CLIENT_SECRET`/`JWKS_URI`/`IDP_AUDIENCE`/`IDP_ISSUER`.
  - Bootstrap admin: `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD` no boot, cria super_admin se tabela `users` vazia.
  - Frontend Vue 2: plugin `authPlugin` (`src/auth/auth.ts`), access token em memória, cookie httpOnly para refresh.
  - Frontend Vue 3: composable `useAuth` (`src/composables/useAuth.ts`) drop-in da API Auth0.
- **Data**: TypeORM entities em `apps/msgops-api/src/entities/*.entity.ts`; migrations em `src/migrations/<timestamp>-<desc>.ts`.
- **Guards**: `PrincipalContextGuard` + `PermissionGuard` registrados globalmente; decorators `@RequirePermission('key')`, `@RequireSuperAdmin()`, `@PublicRoute()`.
- **API docs**: Swagger em `/api-docs` (NestJS).
