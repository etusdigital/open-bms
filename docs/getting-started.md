# Getting Started

Open BMS is a multi-channel messaging operations platform. This guide walks you
through running it locally for development.

## Prerequisites

| Dependency | Minimum version | How to check                                             |
| ---------- | --------------- | -------------------------------------------------------- |
| Node.js    | 24              | `node --version`                                         |
| pnpm       | 10              | `corepack enable && corepack prepare pnpm@10 --activate` |
| Docker     | 24 + Compose v2 | `docker compose version`                                 |

The compose file boots PostgreSQL, Redis, RabbitMQ, ClickHouse and MinIO — you
do not need to install them on the host.

---

## 1. Clone and install

```bash
git clone https://github.com/etusdigital/open-bms.git
cd open-bms
pnpm install
```

## 2. Boot the infrastructure

```bash
docker compose up -d
```

This starts Postgres, Redis, RabbitMQ, ClickHouse, MinIO and all the BMS
services. Use `docker compose ps` to confirm everything is healthy.

Alternative: bring up only the infra services and run the app code on the host
via `pnpm dev`:

```bash
make infra      # boots only postgres, redis, rabbitmq, clickhouse
pnpm dev        # runs all apps in watch mode
```

## 3. Open the UI

- Frontend: <http://localhost:5001>
- ClickHouse console (ch-ui): <http://localhost:3488>
- RabbitMQ management: <http://localhost:15672>
- MinIO console: <http://localhost:9001>

## 4. First boot — Setup Wizard

On a fresh install the `users` table is empty, and the app redirects you to
`/setup`. The wizard walks through these steps:

### Step 1 — Admin account

Creates the platform's super-admin user (name, email, password ≥ 8 chars).
Persists into `users` with `role = super_admin`. An advisory lock serializes
concurrent submissions.

> **Alternative (no UI)**: set `BOOTSTRAP_ADMIN_EMAIL` and
> `BOOTSTRAP_ADMIN_PASSWORD` before the first boot — the admin is created
> automatically.

### Step 2 — SMTP server

Configures the SMTP server used for transactional emails (host, port, user,
password, From address). The "Test SMTP" button sends a test email to the
admin's address (rate-limited to 5 attempts per minute per IP). Stored in
`system_config` under the `smtp_settings` key.

### Step 3 — Base URL

Public URL of the platform (e.g. `https://app.example.com`). Used in email
links, redirects and external integrations. Stored in `system_config` under
`domain_settings`.

### Step 4 — IP pool and first account

Creates the parent account and the sending IP pool: account name, pool name,
sender email + name, reply-to, send limit, and IP list. You can skip this
step and configure later from the admin UI.

### Step 5 — Service health check

Verifies that every infra dependency is reachable. Probes run in parallel with
a 5 s timeout each:

| Service    | Probe               | Env vars             |
| ---------- | ------------------- | -------------------- |
| PostgreSQL | `SELECT 1`          | `TYPEORM_*`          |
| Redis      | `PING`              | `REDIS_*`            |
| ClickHouse | `SELECT 1`          | `CLICKHOUSE_*`       |
| RabbitMQ   | TCP connect + close | `AMQP_URL`           |
| S3 / MinIO | `HeadBucket`        | `S3_*`               |
| SMTP       | `STARTTLS verify`   | configured in step 2 |

"Finish" is only enabled when every probe returns `ok: true`. You can skip
specific probes when a service is intentionally disabled.

---

## Manual health check

```bash
# Before the wizard completes:
curl -s http://localhost:5001/setup/health-check | jq .

# Expected payload (all ok):
{
  "postgres":   { "ok": true, "latencyMs": 4 },
  "redis":      { "ok": true, "latencyMs": 1 },
  "clickhouse": { "ok": true, "latencyMs": 12 },
  "rabbitmq":   { "ok": true, "latencyMs": 8 },
  "s3":         { "ok": true, "latencyMs": 35 },
  "smtp":       { "ok": true, "latencyMs": 220 },
  "allOk": true
}
```

See [`reference/health-check-endpoint.md`](./reference/health-check-endpoint.md)
for examples and error interpretation.

---

## Common commands

```bash
pnpm dev                 # Watch mode for all apps
pnpm build               # Build everything
pnpm type-check          # tsc --noEmit across the workspace
pnpm lint                # ESLint
pnpm test                # Unit tests
pnpm clean               # Remove build artifacts
```

Per-app:

```bash
pnpm --filter msgops-api dev
pnpm --filter frontend-react dev
pnpm --filter @msgops/segment-query-builder test
```

`Makefile` has convenience targets (`make help` to list):

```bash
make up                  # docker compose up -d --build
make down                # docker compose down (keeps volumes)
make migrate             # Run TypeORM migrations against compose postgres
make db-shell            # psql into compose postgres
make logs-api            # Tail msgops-api logs
make clean               # down + remove volumes (DESTROYS DATA)
```

---

## Authentication providers

Default is `AUTH_PROVIDER=local` (JWT issued by msgops-api). To switch to
Auth0:

```env
AUTH_PROVIDER=auth0
AUTH0_DOMAIN=<tenant>.us.auth0.com
AUTH0_CLIENT_ID=<client-id>
AUTH0_CLIENT_SECRET=<client-secret>
JWKS_URI=https://<tenant>.us.auth0.com/.well-known/jwks.json
IDP_ISSUER=https://<tenant>.us.auth0.com/
IDP_AUDIENCE=<api-audience>
```

When Auth0 is active, step 1 of the wizard delegates user creation to the
Auth0 Management API instead of writing directly to `users`.

---

## Where to go next

| Goal                                | Doc                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| Deploy to production (Docker Swarm) | [`../infra/swarm/DEPLOY.md`](../infra/swarm/DEPLOY.md)                       |
| Operate email providers             | [`operations/email-providers.md`](./operations/email-providers.md)           |
| Refresh the GeoIP database          | [`operations/geodb.md`](./operations/geodb.md)                               |
| ClickHouse schema reference         | [`reference/clickhouse-schema.md`](./reference/clickhouse-schema.md)         |
| Health-check endpoint contract      | [`reference/health-check-endpoint.md`](./reference/health-check-endpoint.md) |

The full list of environment variables lives in
[`../.env.example`](../.env.example) and in each `apps/<app>/.env.example`.
