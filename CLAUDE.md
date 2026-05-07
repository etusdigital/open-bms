# BMS Open Source

## Overview

Messaging operations platform (BMS) for multi-channel campaigns — email, SMS, push, WhatsApp. Monorepo with NestJS backend, Vue 2 + React frontends, and supporting workers.

## Architecture

- **Monorepo**: Turborepo + pnpm
- **Frontends**:
  - `apps/frontend-vue2` — Vue 2 SPA (operator workspace, Vuex, axios)
  - `apps/frontend-react` — React SPA (operator + super-admin console, TanStack Router/Query, shadcn/ui)
- **Backend** (`apps/msgops-api`): NestJS — REST API + TypeORM (PostgreSQL) + Redis
- **Workers**: `event-process`, `send-email`, `campaign-packer`, etc. (separate Nest/Node apps)
- **Operational DB**: PostgreSQL via TypeORM (`apps/msgops-api/src/entities/*.entity.ts`)
- **Analytics**: ClickHouse (separate deployment, consumed by workers)
- **Auth**: Pluggable via `IAuthProvider` — default `LocalAuthProvider` (JWT HS256 + bcrypt); `Auth0AuthProvider` opcional via `AUTH_PROVIDER=auth0`
- **Email providers**: Pluggable via `IEmailProvider` (`apps/send-email/src/handlers/email-provider.interface.ts`). 6 providers registered: SparkPost, SendGrid, MailerSend, Resend (free tier + webhook), Amazon SES, Mandrill (paid, opt-in). Eligibility gate enforces `hasWebhook: true` no boot via `EmailProvidersModule.onModuleInit()`. Routing per-account via `account.accountConfigs.default_email_provider`. Setup completo em [`docs/email-providers.md`](docs/email-providers.md).

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

# Frontend React (apps/frontend-react)
pnpm --filter frontend-react dev
```

## Project Structure

```
apps/
  msgops-api/              # NestJS — REST API (auth, users, campaigns, messaging)
  frontend-vue2/           # Vue 2 SPA (operator workspace)
  frontend-react/          # React SPA (operator + super-admin console)
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
  - Frontend React: store `app-store` em `src/stores/app-store.ts`, access token em memória, cookie httpOnly para refresh.
- **Data**: TypeORM entities em `apps/msgops-api/src/entities/*.entity.ts`; migrations em `src/migrations/<timestamp>-<desc>.ts`.
- **Guards**: `PrincipalContextGuard` + `PermissionGuard` registrados globalmente; decorators `@RequirePermission('key')`, `@RequireSuperAdmin()`, `@PublicRoute()`.
- **API docs**: Swagger em `/api-docs` (NestJS).
- **Email Providers**:
  - 6 providers integrados: `sparkpost`, `sendgrid`, `mailersend`, `resend` (free tier + webhook), `ses`, `mandrill` (pagos, opt-in via `hasFreeTier: false`).
  - Send-side: `IEmailProvider` em `apps/send-email/src/handlers/<provider>/`. Resolução por mensagem via `EmailProviderRouter` (`account.accountConfigs.default_email_provider` → ippool fallback → env).
  - Webhook-side: `apps/event-process/src/events/services/<provider>.service.ts` + `@Post('<provider>')` em `app.controller.ts`. Cada provider valida sua própria assinatura (Basic Auth/HMAC/Svix/SNS) antes de `processWithIdempotency`.
  - Admin: `PUT/GET /admin/integrations/<provider>/settings` + `POST .../test-connection` (rate-limited 5/min). Credenciais persistem em `system_config` table; bootstrap reescreve env file no startup.
  - Setup completo em [`docs/email-providers.md`](docs/email-providers.md).
