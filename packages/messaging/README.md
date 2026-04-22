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

## Conventions

| Item        | Pattern                             | Example                     |
| ----------- | ----------------------------------- | --------------------------- |
| Exchange    | `bms.<domain>` (topic)              | `bms.email`                 |
| Routing key | `<resource>.<action>[.<qualifier>]` | `email.send.batch`          |
| Queue       | `<service>.<routing-key>`           | `send-email.email.send`     |
| DLQ         | `<queue>.dlq`                       | `send-email.email.send.dlq` |
| DLX         | `bms.dlx` (shared)                  | —                           |

See decision doc for full rules.
