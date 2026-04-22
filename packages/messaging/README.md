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

process.on('SIGTERM', () => consumer.shutdown());
```

### HTTP bridge handler

For the common pattern of "consume AMQP → call internal HTTP endpoint → translate response", use `createHttpBridgeHandler`. Implements the contract from the decision doc: POST with `X-Internal-Token`, maps `5xx → 'nack'`, `429 → 'requeue'`, everything else → `'ack'`.

```typescript
import { AmqpConsumer, createHttpBridgeHandler, EXCHANGES } from '@bms/messaging';

const handler = createHttpBridgeHandler({
  endpoint: 'http://localhost:3000/internal/email/send',
  token: process.env.INTERNAL_AUTH_TOKEN!,
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

Tracing headers `X-Bms-Attempt` and `X-Bms-Routing-Key` are added automatically. Apps that need custom semantics (different status mappings, alternative auth, non-HTTP handlers) can skip this helper and pass their own `Handler` to `consume()`.

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
