# msgops-tag-process

NestJS worker that processes contact-tagging jobs and segment scheduling
for the BMS Open Source platform. Consumes jobs from BullMQ (Redis-backed)
queues, persists changes via the central PostgreSQL database, and emits
analytics events to ClickHouse via downstream workers.

## Scope

- Tag application/removal on contacts (single + batch).
- Real-time and scheduled segment processing.
- Contact creation in batch with email-provider derivation.
- Pixel-event emission via tracker URL.

## Development

```bash
# From the repository root
pnpm install
pnpm --filter msgops-tag-process dev      # watch mode
pnpm --filter msgops-tag-process build    # production build
pnpm --filter msgops-tag-process test     # unit tests (Jest)
pnpm --filter msgops-tag-process lint
```

## Configuration

Copy `.env.example` to `.env` and adjust. Required groups:

- **Database** (`TYPEORM_*`) — PostgreSQL connection.
- **Redis** (`REDIS_*`) — cache + queues.
- **ClickHouse** (`CLICKHOUSE_*`) — analytics output.
- **Cloud Tasks** (`GOOGLE_TASKS_*`) — segment scheduling backend.
- **Topics** (`TOPIC_NAME_*`) — internal pub/sub channels.
- **Tracker** (`PIXEL_EVENT_STORE_URL`) — optional pixel sink.

Logging follows `LOG_LEVEL` (default `info`) and emits structured JSON
via [pino](https://github.com/pinojs/pino) — provider-agnostic, pipe to
any aggregator.

## Advanced Analytics

Aggregated analytics (e.g. BigQuery, Snowflake, Redshift sinks) are
**out of scope** for the v0.1 BMS Open Source release. The platform
targets a pluggable analytics adapter on the **v0.2.x roadmap**, where
a BigQuery sink will be available as an optional plugin alongside
other warehouse backends. The current release ships ClickHouse as the
default analytics store.

## Testing

Jest 30 with `ts-jest`, co-located `*.spec.ts`. Coverage threshold:
80% (statements, branches, functions, lines).
