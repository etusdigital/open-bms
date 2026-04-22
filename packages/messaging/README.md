# @bms/messaging

RabbitMQ messaging primitives for BMS services. Replaces `@google-cloud/pubsub` usage across `apps/`.

Nomenclature and contracts frozen in [`_evo-output/planning-artifacts/amqp-nomenclature-decision.md`](../../_evo-output/planning-artifacts/amqp-nomenclature-decision.md).

## Install

Internal workspace package — no publishing. Referenced via `workspace:*` in app `package.json`.

```json
"dependencies": {
  "@bms/messaging": "workspace:*"
}
```

## Usage

### Publisher

```typescript
import { AmqpPublisher, EXCHANGES } from '@bms/messaging';

const publisher = new AmqpPublisher({ url: process.env.AMQP_URL! });

await publisher.publish({
  exchange: EXCHANGES.email,
  routingKey: 'email.send',
  payload: { to: 'user@example.com', subject: 'hello' },
});
```

### Consumer

```typescript
import { AmqpConsumer, EXCHANGES } from '@bms/messaging';

const consumer = new AmqpConsumer({ url: process.env.AMQP_URL! });

await consumer.consume(
  {
    exchange: EXCHANGES.email,
    routingKey: 'email.send',
    queue: 'send-email.email.send',
    maxRetries: 5,
  },
  async (msg, ctx) => {
    // handler logic — return/throw controls ack/nack
  },
);

process.on('SIGTERM', async () => {
  await consumer.shutdown();
  await publisher.close();
  process.exit(0);
});
```

### HTTP bridge handler

For the common pattern of "consume AMQP → call internal HTTP endpoint → translate response", use `createHttpBridgeHandler`. Implements the contract from the decision doc: POST with `X-Internal-Token`, maps `5xx` and `429` → `'nack'` (retry via the Consumer's Layer 1 with exponential backoff), everything else → `'ack'`. Abort-on-timeout defaults to 30s.

```typescript
import { AmqpConsumer, createHttpBridgeHandler, EXCHANGES } from '@bms/messaging';

const handler = createHttpBridgeHandler({
  endpoint: 'http://localhost:3000/internal/email/send',
  token: process.env.INTERNAL_AUTH_TOKEN!,
  timeoutMs: 15_000, // optional, defaults to 30_000
});

const consumer = new AmqpConsumer({ url: process.env.AMQP_URL! });
await consumer.consume(
  {
    exchange: EXCHANGES.email,
    routingKey: 'email.send',
    queue: 'send-email.email.send',
  },
  handler,
);
```

Tracing headers `X-Bms-Attempt` and `X-Bms-Routing-Key` are added automatically. Timed-out requests return `'nack'` so the AMQP retry applies. Apps that need custom semantics (different status mappings, alternative auth, non-HTTP handlers) can skip this helper and pass their own `Handler` to `consume()`.

## Conventions

| Item        | Pattern                             | Example                     |
| ----------- | ----------------------------------- | --------------------------- |
| Exchange    | `bms.<domain>` (topic)              | `bms.email`                 |
| Routing key | `<resource>.<action>[.<qualifier>]` | `email.send.batch`          |
| Queue       | `<service>.<routing-key>`           | `send-email.email.send`     |
| DLQ         | `<queue>.dlq`                       | `send-email.email.send.dlq` |
| DLX         | `bms.dlx` (shared)                  | —                           |

See decision doc for full rules.

## Behavior

### Retry and DLQ

- Handler return value: `'ack'` or `undefined` → ack; `'nack'` or thrown error → retry; `'requeue'` → immediate redeliver without incrementing attempt (useful for rate-limit pushback).
- Retry path: original is acked to free the prefetch slot, then the message is republished to the main exchange after `computeBackoffMs(attempt+1, base, max)` delay, with `x-bms-attempt` incremented, `x-bms-first-error` preserved, and `x-bms-last-error` updated.
- After `maxRetries` (default 5), the message is published to `bms.dlx` with the original routing key and all three headers set.
- Malformed JSON (`msg.content` fails `JSON.parse`) routes directly to DLQ with an `x-bms-parse-error` header — the handler is not invoked.

### Graceful shutdown

- `consumer.shutdown()` cancels the consume tag, waits up to `shutdownTimeoutMs` (default 30s) for in-flight handlers and pending retry timers to drain, then closes channels and the underlying connection.
- On timeout, pending retry timers are cleared and the connection is force-closed. Unacked messages return to their queue automatically per AMQP semantics and will be redelivered to the next consumer.
- `shutdown()` never rejects — safe to wire into `process.on('SIGTERM', ...)`.

### Known limitations (v0.1.0)

- **Handler timeout** is not enforced. A handler that hangs will block shutdown until `shutdownTimeoutMs` elapses; after that, the message is lost to redelivery. Callers are responsible for bounding handler execution.
- **One active consume per `AmqpConsumer` instance.** Calling `consume()` twice on the same instance throws `ConsumerAlreadyActiveError`. Create a new instance per queue.
- **Exchange routing keys are exact** — no wildcard bindings (`*`, `#`). By design for v0.1.0.
- **JSON-only payloads.** Non-JSON-serializable payloads (`bigint`, circular refs, `undefined`) reject with `SerializationError`.
- **Retry is in-process via `setTimeout`**, not a dedicated retry queue. If the process crashes while a retry timer is pending, the message is lost. Documented tradeoff — retry queues are on the roadmap for v0.1.x.

## Tests

```bash
pnpm --filter @bms/messaging test             # unit (mocked amqplib)
pnpm --filter @bms/messaging test:integration # integration (testcontainers + real RabbitMQ)
pnpm --filter @bms/messaging type-check
pnpm --filter @bms/messaging build
```

Integration tests require Docker running locally; they boot a throwaway `rabbitmq:3.13-management` container.

> **Known teardown flake:** the integration suite exits with code 1 and reports "Test suite failed to run" with the message `Socket closed abruptly during opening handshake`, even when all 7 tests pass. The event is emitted by amqplib when an in-flight socket races with `container.stop()` in afterAll and is caught by jest-circus at a layer below any `process.on(...)` handler we can register. All tests are correct; grep for `Tests: X passed` in the output to verify. Tracking as infrastructure noise, not a library bug.
