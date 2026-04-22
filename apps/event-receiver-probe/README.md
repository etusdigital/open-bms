# event-receiver-probe

Canonical Padrão B (Consumer-HTTP-bridge) example + DLQ validation probe for EVO-943 pilot.
Serves two purposes:

1. Validation: exercise the `@bms/messaging` AmqpConsumer → HTTP bridge round-trip (AC 5) and
   DLQ flow after retries exhausted (AC 7).
2. Playbook reference: minimal, production-shaped template the 12 Phase 3 apps copy from.

## Run

Required env (see `.env.example`):

- `PORT` (default 3012)
- `AMQP_URL`
- `INTERNAL_AUTH_TOKEN` — must match the token the bridge handler sends
- `BRIDGE_ENDPOINT` — where the consumer POSTs decoded messages
- `PROBE_ALWAYS_ERROR` — optional; when set to a 4xx/5xx integer, every `/internal/event/received`
  call returns that status. Drives DLQ validation without code changes.

```bash
pnpm --filter msgops-event-receiver-probe dev
```

### DLQ validation

```bash
PROBE_ALWAYS_ERROR=500 pnpm --filter msgops-event-receiver-probe dev
```

With `maxRetries: 3` the bridge nacks three times (attempts 1→2→3), then the consumer
routes the message to `event-process-probe.event.received.sendgrid.dlq`.

### Ad-hoc overrides

Per-request: `X-Probe-Force-Error: 503` header overrides env var for a single call.

## Guardrails

- Refuses to boot with `NODE_ENV=production` + default `INTERNAL_AUTH_TOKEN=dev-probe-token`.
- `shutdownTimeoutMs=10_000` on the consumer to fit the Kubernetes SIGTERM grace.

## See also

- Playbook: [`docs/plans/2026-04-22-migration-pattern.md`](../../docs/plans/2026-04-22-migration-pattern.md)
- Lib docs: [`packages/messaging/README.md`](../../packages/messaging/README.md)
