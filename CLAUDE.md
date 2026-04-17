# Etus Retention Backoffice

## Overview

Internal backoffice for the retention team to monitor and manage email delivery operations. V0 focuses on reports and monitoring; V1 will add management features.

## Architecture

- **Monorepo**: Turborepo + pnpm
- **Frontend** (`apps/frontend`): Next.js 16 App Router on GCP Cloud Run (port 3000)
- **Backend** (`apps/backoffice-api`): NestJS on GCP Cloud Run (port 3001)
- **Analytics DB**: ClickHouse Cloud (materialized views for auto-aggregation)
- **Operational DB**: PostgreSQL (accounts, pools, alerts) via TypeORM
- **Auth**: Auth0 (frontend: `@auth0/nextjs-auth0`, backend: `passport-jwt` + JWKS)

## Key Commands

```bash
pnpm install          # Install all dependencies
pnpm dev              # Dev all apps (Next.js + NestJS)
pnpm build            # Build all apps
pnpm type-check       # TypeScript check
```

### Per-app commands

```bash
# Frontend (apps/frontend)
pnpm --filter @backoffice/frontend dev    # Next.js dev server at :3000

# Backend (apps/backoffice-api)
pnpm --filter @backoffice/api dev         # NestJS dev server at :3001

# Database package (packages/database)
pnpm --filter @retention/database build   # Build TypeORM entities
```

### Docker

```bash
# Backend (run from repo root)
docker build -f apps/backoffice-api/Dockerfile -t retention-backend .
docker run -p 3001:3001 --env-file apps/backoffice-api/.env retention-backend

# Frontend (run from repo root)
docker build -f apps/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_BACKEND_URL=https://api.example.com \
  -t retention-frontend .
docker run -p 3000:3000 retention-frontend
```

## Data Sources

### ClickHouse Cloud (BMS database)

- `events_logs_v2` - raw email events (written by msgops-event-process)
- `tb_email_hourly_stats` - email events auto-aggregated via `mv_email_hourly` materialized view
- **Full schema, indexes, and query performance rules**: see [`docs/clickhouse-schema.md`](docs/clickhouse-schema.md)

### PostgreSQL (GCP)

- `accounts` / `pools` - read-only operational data
- `retention_alerts` - anomaly alerts

## Project Structure

```
apps/
  frontend/       # Next.js 16 App Router - shadcn/ui, TanStack Query, Zustand, Recharts, next-intl
  backoffice-api/ # NestJS API - ClickHouse + TypeORM/PostgreSQL + Auth0 (passport-jwt)
packages/
  database/       # @retention/database - TypeORM entities and data source config
  shared/         # @retention/shared - Types, constants, thresholds
  typescript-config/
  eslint-config/
migrations/
  clickhouse/     # MV creation + backfill SQL (run manually via CH console)
  postgres/       # retention_alerts table DDL
```

## Conventions

- UI components: shadcn/ui (Radix + TailwindCSS v4)
- Data fetching: @tanstack/react-query (always include accountIds in query keys)
- State: Zustand for global filters
- Forms: react-hook-form + zod (when needed for V1)
- Internationalization: next-intl (messages in `apps/frontend/messages/`)
- ClickHouse queries: Raw SQL via @clickhouse/client-web
- PG queries: TypeORM via @retention/database package
- Auth (backend): passport-jwt with JWKS for Auth0 JWT validation
- Auth (frontend): @auth0/nextjs-auth0 with App Router integration
- API docs: Swagger at `/api-docs` endpoint (NestJS)
- Searchable entity filters (accounts, senders, pools): Use the `SearchableSelect` component (`@/components/searchable-select`) — a Popover + Command (cmdk) combo with built-in search input. Fetch options via `useAccounts`/`useFilterOptions` from `@/features/reports/hooks/use-reports`, build `{ value: string; label: string }[]` options with an "All" entry first, persist selection with `useQueryState` from `nuqs`, and wrap in a `<div className="space-y-1">` with a `<label>`. See report pages (e.g., `pool-report-page.tsx`) for reference. Never use plain `Select` for these entity lists.
