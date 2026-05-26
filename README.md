<h1 align="center">Open BMS</h1>

<p align="center">
  Open-source messaging operations platform — multi-channel campaigns, segmentation and analytics. By Etus Digital.
</p>

<p align="center">
  <a href="https://github.com/etusdigital/bms-open/releases/latest"><img src="https://img.shields.io/github/v/release/etusdigital/bms-open?include_prereleases&label=version" alt="Latest version" /></a>
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License: Apache 2.0" /></a>
  <a href="https://github.com/etusdigital/bms-open/actions"><img src="https://github.com/etusdigital/bms-open/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

<p align="center">
  <a href="https://etus.com.br/open-bms">Website</a> &middot;
  <a href="https://github.com/etusdigital/bms-open">Repository</a> &middot;
  <a href="./infra/swarm/DEPLOY.md">Deploy guide</a> &middot;
  <a href="./CONTRIBUTING.md">Contributing</a>
</p>

---

## About

**Open BMS** is the open-source edition of the BMS platform — a complete suite
for messaging operations: email, push, SMS and WhatsApp campaigns at scale, with
audience segmentation, automations, deliverability tracking and per-channel
analytics.

This is the **monorepo entrypoint**: it bundles backend services, workers, the
React frontend and the supporting infrastructure (Postgres, ClickHouse, RabbitMQ,
Redis, MinIO) into a single repository orchestrated by Turborepo + pnpm.

---

## Architecture

| Layer              | Component                                                   | Stack                                                     |
| ------------------ | ----------------------------------------------------------- | --------------------------------------------------------- |
| API                | [`msgops-api`](./apps/msgops-api)                           | NestJS 11, TypeORM, Postgres                              |
| Web UI             | [`frontend-react`](./apps/frontend-react)                   | React, Vite, TanStack Router/Query, shadcn/ui             |
| Webhook ingress    | [`event-receiver`](./apps/event-receiver)                   | NestJS                                                    |
| Event processing   | [`event-process`](./apps/event-process)                     | NestJS, AMQP consumer                                     |
| Campaign packer    | [`campaign-packer`](./apps/campaign-packer)                 | NestJS, BullMQ                                            |
| Campaign tracker   | [`campaign-events-tracker`](./apps/campaign-events-tracker) | NestJS                                                    |
| Channel: email     | [`send-email`](./apps/send-email)                           | NestJS, SendGrid/SparkPost/SES/Mailersend/Resend/Mandrill |
| Channel: push      | [`send-push`](./apps/send-push)                             | NestJS, FCM                                               |
| Channel: WhatsApp  | [`send-whatsapp`](./apps/send-whatsapp)                     | NestJS, Evolution API                                     |
| Channel: SMS/voice | [`twilio-messaging`](./apps/twilio-messaging)               | NestJS, Twilio                                            |
| Tracker pixel      | [`tracker`](./apps/tracker)                                 | NestJS                                                    |
| Segment processor  | [`tag-process`](./apps/tag-process)                         | NestJS, ClickHouse                                        |
| Automation trigger | [`message-trigger`](./apps/message-trigger)                 | NestJS, BullMQ                                            |
| GeoIP service      | [`geolocation`](./apps/geolocation)                         | NestJS, MaxMind/DB-IP gRPC                                |
| Enterprise import  | [`enterprise-import`](./apps/enterprise-import)             | NestJS, BullMQ                                            |

**Infra services**: Postgres 16, ClickHouse 24.8, RabbitMQ 3.13, Redis 7, MinIO,
ch-ui (ClickHouse web console).

### Shared packages

- [`packages/segment-query-builder`](./packages/segment-query-builder) — DSL → SQL query builder for segments
- [`packages/messaging`](./packages/messaging) — AMQP / BullMQ helpers
- [`packages/geo`](./packages/geo) — GeoIP types and gRPC client
- [`packages/shared`](./packages/shared) — cross-cutting types and constants
- [`packages/database`](./packages/database) — TypeORM data source helpers
- `packages/eslint-config`, `packages/typescript-config`, `packages/test-config` — tooling

---

## Quick start (local development)

### Prerequisites

- **Docker** and **Docker Compose** v2
- **Node.js** ≥ 24
- **pnpm** ≥ 10 (`corepack enable && corepack prepare pnpm@10 --activate`)

### 1. Clone

```bash
git clone https://github.com/etusdigital/bms-open.git
cd bms-open
pnpm install
```

### 2. Boot the stack

```bash
docker compose up -d
pnpm dev
```

The compose file boots all infra dependencies (Postgres, ClickHouse, RabbitMQ,
Redis, MinIO) plus the apps. `pnpm dev` runs the apps in watch mode via Turborepo.

### 3. Open the UI

- Frontend: <http://localhost:5001> (or the port published by `frontend-react`)
- ClickHouse console (ch-ui): <http://localhost:3488>
- RabbitMQ management: <http://localhost:15672>

### 4. First-time setup

Open `/setup` in the frontend to create the initial super-admin account. From
there, register your email providers (SendGrid, SparkPost, etc.) under
**Super Admin → Integrations**.

---

## Production deployment

Production deploys run on **Docker Swarm** via Portainer. The complete guide
lives in [`infra/swarm/DEPLOY.md`](./infra/swarm/DEPLOY.md).

In short:

1. Create the Swarm `configs` for ClickHouse (one-time setup, see DEPLOY.md §2)
2. Deploy Traefik with [`infra/swarm/stack.traefik.yml`](./infra/swarm/stack.traefik.yml)
3. Deploy the main stack with [`infra/swarm/stack.bms.yml`](./infra/swarm/stack.bms.yml)

Docker images are published to Docker Hub under the **`etusdigital`** organization:

```bash
docker pull etusdigital/bms-msgops-api:latest
docker pull etusdigital/bms-frontend-react:latest
# ...one image per service in apps/
```

`latest` always tracks the most recent release; pin to a specific version for
reproducible deploys.

---

## Development

### Common commands

```bash
pnpm dev              # Watch mode for all apps
pnpm build            # Build everything
pnpm type-check       # tsc --noEmit across the workspace
pnpm lint             # ESLint
pnpm test             # Unit tests (vitest / jest depending on app)
pnpm clean            # Remove build artifacts
```

### Per-app commands

```bash
pnpm --filter msgops-api dev
pnpm --filter frontend-react dev
pnpm --filter @msgops/segment-query-builder test
```

### Adding a migration

Backend uses TypeORM. Create a migration under `apps/msgops-api/src/migrations/`
named `<timestamp>-<description>.ts`. Migrations run automatically on boot when
`TYPEORM_MIGRATIONS_RUN=true` (default in the compose file).

---

## Documentation

| Topic                                 | Where                                                              |
| ------------------------------------- | ------------------------------------------------------------------ |
| Production deploy (Swarm + Portainer) | [`infra/swarm/DEPLOY.md`](./infra/swarm/DEPLOY.md)                 |
| Getting started locally               | [`docs/getting-started.md`](./docs/getting-started.md)             |
| Deployment runbook                    | [`docs/deployment.md`](./docs/deployment.md)                       |
| Email providers (setup + webhook)     | [`docs/email-providers.md`](./docs/email-providers.md)             |
| ClickHouse schema                     | [`docs/clickhouse-schema.md`](./docs/clickhouse-schema.md)         |
| GeoIP / DB-IP setup                   | [`docs/geodb.md`](./docs/geodb.md)                                 |
| Health-check endpoint contract        | [`docs/health-check-endpoint.md`](./docs/health-check-endpoint.md) |

---

## Contributing

Issues, bug reports and pull requests are welcome. See
[`CONTRIBUTING.md`](./CONTRIBUTING.md) for the workflow, commit conventions and
review checklist.

For security vulnerabilities, **do not open a public issue** —
follow [`SECURITY.md`](./SECURITY.md).

---

## Attributions

IP geolocation data provided by [DB-IP.com](https://db-ip.com) under the
[Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

---

## License

Source code is licensed under the [Apache License 2.0](./LICENSE).
Trademarks and brand assets are governed by [`TRADEMARKS.md`](./TRADEMARKS.md).

© 2026 Etus Digital
