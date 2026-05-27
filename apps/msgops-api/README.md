# msgops-api

Core REST API for Open BMS — authentication, accounts, contacts, campaigns,
automations, segments and the super-admin surface. Backed by Postgres
(operational data) via TypeORM and ClickHouse (analytics).

## Run

```bash
pnpm --filter msgops-api dev          # watch mode, port 5001
pnpm --filter msgops-api build
pnpm --filter msgops-api test
```

Requires the infra stack from the root `docker-compose.yml` (Postgres, Redis,
RabbitMQ, MinIO). See [`../../docs/getting-started.md`](../../docs/getting-started.md).

Env vars: copy [`.env.example`](./.env.example) to `.env`.

OpenAPI/Swagger docs are exposed at `/api-docs` when `NODE_ENV !== production`.
