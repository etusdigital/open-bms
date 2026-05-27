# event-process

AMQP consumer that enriches and persists delivery events received by
`event-receiver`. Resolves contact + campaign + message context, applies GeoIP
enrichment (via the `geolocation` service), and forwards enriched events to
ClickHouse for analytics.

## Run

```bash
pnpm --filter event-process dev       # port 3000
```

Depends on RabbitMQ, Postgres (read), ClickHouse (write), and the
`geolocation` gRPC service.

Env vars: see [`.env.example`](./.env.example).
Tests use [`.env.test.example`](./.env.test.example) — copy to `.env.test`.
