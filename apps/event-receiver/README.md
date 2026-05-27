# event-receiver

Public webhook ingress — receives delivery events from email providers
(SendGrid, SparkPost, SES, etc.), validates the provider's signature, and
publishes them onto RabbitMQ for downstream processing by `event-process`.

## Run

```bash
pnpm --filter event-receiver dev      # port 3011
```

Exposed externally at `<frontend-host>/bms/events` (Traefik route in
`infra/swarm/stack.bms.yml`). Each provider has its own webhook path —
register the URL in the provider's dashboard during setup.

Env vars: see [`.env.example`](./.env.example).
