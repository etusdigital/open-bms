# Etus Retention Backoffice

Internal backoffice for the retention team to monitor and manage email delivery operations. V0 focuses on reports and monitoring; V1 will add management features.

## Architecture

| Component      | Technology                         | Port |
| -------------- | ---------------------------------- | ---- |
| Frontend       | Next.js 16 (App Router)            | 3000 |
| Backend        | NestJS 11                          | 3001 |
| Analytics DB   | ClickHouse Cloud                   | —    |
| Operational DB | PostgreSQL (GCP)                   | —    |
| Auth           | Local (default) / Auth0 (optional) | —    |

**Monorepo**: Turborepo + pnpm

```
apps/
  frontend/         # Next.js 16 - shadcn/ui, TanStack Query, Zustand, ECharts, next-intl
  backoffice-api/   # NestJS - ClickHouse + TypeORM/PostgreSQL + Auth0 (passport-jwt)
packages/
  database/         # @retention/database - TypeORM entities and data source config
  shared/           # @retention/shared - Types, constants, thresholds
  typescript-config/
  eslint-config/
migrations/
  clickhouse/       # Materialized view creation + backfill SQL
  postgres/         # retention_alerts table DDL
```

## Prerequisites

- Node.js >= 20
- pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- Access to ClickHouse Cloud and PostgreSQL instances
- `JWT_SECRET` (gere com `openssl rand -hex 32`) e `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` para o primeiro boot em modo `local` (default).
- Auth0 tenant — apenas se rodar com `AUTH_PROVIDER=auth0`.

> Para OSS self-hosted, `AUTH_PROVIDER=local` é o default. Set `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` antes do primeiro boot para criar o super_admin inicial.

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment files
cp apps/backoffice-api/.env.example apps/backoffice-api/.env
cp apps/frontend/.env.example apps/frontend/.env

# Start all apps in development
pnpm dev
```

### Per-app commands

```bash
pnpm --filter @retention/frontend dev     # Next.js at :3000
pnpm --filter @retention/backend dev      # NestJS at :3001
pnpm --filter @retention/database build   # Build TypeORM entities
```

### Other commands

```bash
pnpm build            # Build all apps
pnpm type-check       # TypeScript check
pnpm lint             # Lint all apps
pnpm clean            # Clean build artifacts
```

## Deploy to GCP Cloud Run

Both apps are containerized with multi-stage Dockerfiles that handle the monorepo workspace (shared packages are built inside Docker). All commands must be run **from the repository root** so Docker has access to the full workspace.

### Prerequisites

- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated
- Artifact Registry repository created
- Cloud Run API enabled

```bash
# Authenticate and set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Create Artifact Registry repository (one-time)
gcloud artifacts repositories create retention \
  --repository-format docker \
  --location southamerica-east1
```

### Backend

```bash
# Build and push
gcloud builds submit \
  --tag southamerica-east1-docker.pkg.dev/YOUR_PROJECT/retention/backend:latest \
  --dockerfile apps/backoffice-api/Dockerfile \
  .

# Deploy
gcloud run deploy retention-backend \
  --image southamerica-east1-docker.pkg.dev/YOUR_PROJECT/retention/backend:latest \
  --region southamerica-east1 \
  --port 3001 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,PORT=3001" \
  --set-secrets "CLICKHOUSE_URL=clickhouse-url:latest,CLICKHOUSE_PASSWORD=clickhouse-password:latest,POSTGRES_HOST=postgres-host:latest"
```

### Frontend

The frontend requires `NEXT_PUBLIC_BACKEND_URL` at **build time** (Next.js inlines public env vars during the build). Use `docker build` + `docker push` to pass the build arg:

```bash
# Build with backend URL baked in
docker build \
  -f apps/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_BACKEND_URL=https://retention-backend-XXXXX-rj.a.run.app \
  -t southamerica-east1-docker.pkg.dev/YOUR_PROJECT/retention/frontend:latest \
  .

# Push to Artifact Registry
docker push southamerica-east1-docker.pkg.dev/YOUR_PROJECT/retention/frontend:latest

# Deploy
gcloud run deploy retention-frontend \
  --image southamerica-east1-docker.pkg.dev/YOUR_PROJECT/retention/frontend:latest \
  --region southamerica-east1 \
  --port 3000 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,PORT=3000,HOSTNAME=0.0.0.0" \
  --set-secrets "JWT_SECRET=jwt-secret:latest,BOOTSTRAP_ADMIN_PASSWORD=bootstrap-admin-password:latest"
```

### Local Docker

```bash
# Backend
docker build -f apps/backoffice-api/Dockerfile -t retention-backend .
docker run -p 3001:3001 --env-file apps/backoffice-api/.env retention-backend

# Frontend
docker build -f apps/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_BACKEND_URL=http://localhost:3001 \
  -t retention-frontend .
docker run -p 3000:3000 --env-file apps/frontend/.env retention-frontend
```

### Notes

- **Deploy backend first** — the frontend build needs the backend URL.
- **Secrets**: Use [Secret Manager](https://cloud.google.com/secret-manager) with `--set-secrets` instead of `--set-env-vars` for sensitive values.
- **Root `.dockerignore`**: Excludes `node_modules`, build artifacts, `.git`, tests, and docs to keep Cloud Build uploads fast.
- **Build order inside Docker**: Shared packages (`@retention/shared`, `@retention/database`) are built before the app, matching the Turborepo `^build` dependency graph.
- **`X-Forwarded-For` trust**: `msgops-api` reads `X-Forwarded-For` to log login IP and persist it with the refresh token (`user_refresh_tokens.ip`). Deploy **only behind a reverse proxy that strips client-supplied values and appends the real source IP** (Cloud Run, nginx, Cloudflare, ALB). Exposing the Nest port directly to the internet lets any client spoof the header. The value is never used for authorization decisions — only for audit and refresh-reuse forensics — but a spoofed audit log is worse than no log.

## Cron Jobs

The backend exposes internal cron endpoints that are authenticated via the `CRON_SECRET` environment variable (passed in the `x-cron-secret` header). Set up [Cloud Scheduler](https://cloud.google.com/scheduler) jobs to call them on a schedule.

| Endpoint                               | Schedule           | Description                                                                    |
| -------------------------------------- | ------------------ | ------------------------------------------------------------------------------ |
| `POST /internal/cron/detect-anomalies` | Every 15 min       | Runs anomaly detection on email delivery metrics and creates alerts            |
| `POST /internal/cron/refresh-ip-usage` | Daily at 06:00 UTC | Queries ClickHouse for 30-day delivered counts per IP and caches in PostgreSQL |

### Cloud Scheduler setup

```bash
# Anomaly detection — every 15 minutes
gcloud scheduler jobs create http retention-detect-anomalies \
  --location southamerica-east1 \
  --schedule "*/15 * * * *" \
  --uri "https://YOUR_BACKEND_URL/internal/cron/detect-anomalies" \
  --http-method POST \
  --headers "x-cron-secret=YOUR_CRON_SECRET" \
  --time-zone "UTC"

# IP usage refresh — daily at 06:00 UTC
gcloud scheduler jobs create http retention-refresh-ip-usage \
  --location southamerica-east1 \
  --schedule "0 6 * * *" \
  --uri "https://YOUR_BACKEND_URL/internal/cron/refresh-ip-usage" \
  --http-method POST \
  --headers "x-cron-secret=YOUR_CRON_SECRET" \
  --time-zone "UTC"
```

### Manual trigger (for testing)

```bash
curl -X POST https://YOUR_BACKEND_URL/internal/cron/detect-anomalies \
  -H "x-cron-secret: YOUR_CRON_SECRET"

curl -X POST https://YOUR_BACKEND_URL/internal/cron/refresh-ip-usage \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```
