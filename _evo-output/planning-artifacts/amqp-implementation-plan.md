# AMQP Publisher + Consumer — Implementation Plan

| Field               | Value                                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**          | PROPOSED (ready for implementation)                                                                                                           |
| **Issue**           | [EVO-940](https://linear.app/evoai/issue/EVO-940) — Fase 1 — Lib `@bms/messaging`                                                             |
| **Depends on**      | `amqp-nomenclature-decision.md` (frozen 2026-04-20)                                                                                           |
| **Plan decided**    | 2026-04-22                                                                                                                                    |
| **Dev window**      | 2026-04-22 → 2026-04-28 (6 calendar days, solo — Guilherme)                                                                                   |
| **Scope**           | `packages/messaging/src/` only. Publisher, Consumer, shared connection, retry math, DLQ routing, graceful shutdown. Unit + integration tests. |
| **Checkpoint gate** | Fase 2 piloto (EVO-943 `event-receiver`) starts **2026-04-29** — Publisher must be consumable by end of 2026-04-27.                           |

---

## 1. File-by-file outline

Files expected after implementation (five source files + three test files + one jest integration config). The scaffold has `publisher.ts`, `consumer.ts`, `exchanges.ts`, `types.ts`, `index.ts` — of these, `types.ts`, `exchanges.ts` and `index.ts` are **frozen** and only `index.ts` needs one new export line.

### 1.1 `src/connection.ts` (NEW)

**Purpose.** Shared lazy-connect + auto-reconnect wrapper around `amqplib.connect`. Both `AmqpPublisher` and `AmqpConsumer` use it so they can be instantiated before the broker is reachable and recover from transient network loss.

**Exports:**

- `class AmqpConnection`
  - `constructor(opts: ConnectionOptions)`
  - `getConnection(): Promise<amqplib.Connection>` — returns current connection or establishes one (memoized promise; concurrent callers await the same in-flight connect).
  - `createChannel(): Promise<amqplib.Channel>` — opens a new channel on the current connection.
  - `createConfirmChannel(): Promise<amqplib.ConfirmChannel>` — Publisher-only variant.
  - `close(): Promise<void>` — idempotent; closes underlying connection and cancels the reconnect loop.
  - `onReconnect(cb: () => void): void` — subscribers get notified after a successful reconnect; Consumer uses this to re-declare topology and re-open its consume tag.

**Private state:**

- `connPromise: Promise<Connection> | null` (in-flight connect memo)
- `conn: Connection | null` (active connection)
- `closed: boolean` (shutdown flag — once true, never reconnect)
- `reconnectAttempt: number` (for logging / backoff on connect failures)
- `listeners: Array<() => void>` (reconnect subscribers)

**Key behaviors:**

- On `close` or `error` event from `amqplib.Connection`, null out `conn`, clear `connPromise`, schedule reconnect via `setTimeout` using the same retry math from `retry.ts` (reuse — DRY) **unless** `closed === true`.
- Successful reconnect fires all `onReconnect` listeners sequentially; failures in a listener are logged but don't break other listeners.
- `getConnection()` while `closed` rejects with `ConnectionClosedError`.

**Edge cases to handle:**

- Broker down at process start → `connect()` rejects → don't throw from constructor; first `publish`/`consume` call awaits and either returns the connection or surfaces the broker error after N retries (configurable, default 5 before giving up for that caller).
- `amqplib` emits `error` **and** `close` on network drop — dedupe so we don't schedule two reconnects.
- Caller invoking `close()` while a reconnect timer is pending — cancel the timer.

### 1.2 `src/retry.ts` (NEW)

**Purpose.** Pure function for exponential backoff. Isolated so tests don't touch `amqplib`.

**Exports:**

- `computeBackoffMs(attempt: number, baseMs: number, maxMs: number): number`
  - Returns `min(baseMs * 2^(attempt-1), maxMs)`.
  - `attempt` is 1-based to match `MessageContext.attempt`.
  - Guards: `attempt < 1` → returns `baseMs`. `baseMs <= 0` → returns `0`. `maxMs < baseMs` → returns `maxMs`. `attempt` large enough that `2^(attempt-1)` overflows → cap at `maxMs` (use `Number.isFinite` check, don't `Math.pow` blindly).

No state. No side effects. One function, one file, two dozen lines.

### 1.3 `src/publisher.ts` (FILL IN STUB)

**Purpose.** Implements `Publisher`. Lazy-assert exchange on first publish per exchange. JSON-serialize payload. Publisher confirms per-publish for v0.1.0 (see Traps §4.1).

**Public surface (unchanged from scaffold):**

- `class AmqpPublisher implements Publisher`
  - `constructor(opts: ConnectionOptions)`
  - `publish(options: PublishOptions): Promise<void>`
  - `close(): Promise<void>`

**Private state:**

- `conn: AmqpConnection` (owned, instantiated in ctor)
- `channel: ConfirmChannel | null` (lazy, single channel per publisher instance)
- `channelPromise: Promise<ConfirmChannel> | null` (memo for concurrent first-publish callers)
- `assertedExchanges: Set<string>` (avoid re-asserting on every publish)
- `closed: boolean`

**Methods — plain language:**

- `publish(options)`:
  1. If `closed` → reject.
  2. Await `getChannel()` (see below).
  3. If `options.exchange` not in `assertedExchanges` → `channel.assertExchange(exchange, 'topic', { durable: true })` and add. Also assert `DLX` the first time (one-shot).
  4. Build Buffer from `JSON.stringify(payload)`.
  5. Merge `options.headers` with caller values taking precedence (no magic headers added by Publisher — decision doc says headers are not required v0.1.0).
  6. Call `channel.publish(exchange, routingKey, buffer, { persistent: options.persistent ?? true, contentType: 'application/json', headers })`.
  7. `await channel.waitForConfirms()` — resolves when broker acks.
  8. On channel error (unroutable with mandatory flag, nack from broker) → reject with a wrapping error.

- `getChannel()`: returns memoized `channelPromise`. If channel is closed (event handler nulled it), creates a new one. On channel `error`/`close` event: null out `channel`, clear `assertedExchanges` (next publish re-asserts on the new channel).

- `close()`: sets `closed = true`; closes `channel` if open; closes `conn`. Idempotent.

**Edge cases:**

- `publish` racing with reconnect: `getChannel()` awaits the new connection so the retry is transparent.
- JSON.stringify of a payload with `undefined`, `bigint`, circular refs → reject with a `SerializationError` (don't let it reach the broker and fail mid-protocol). Use a try/catch around stringify.
- Unknown exchange name (not in `EXCHANGES` const) — do NOT hard-validate. Decision doc says only adding a new domain requires a PR; the Publisher is still a neutral transport and must allow any string (downstream tests / review catch typos).

### 1.4 `src/consumer.ts` (FILL IN STUB)

**Purpose.** Implements `Consumer`. Asserts full topology (exchange + queue + DLX + DLQ + bindings) on first `consume()` call. Translates handler return value into ack/nack/requeue. Implements in-process retry-with-backoff. Publishes to `DLX` when attempts exhausted. Graceful shutdown drains in-flight.

**Public surface (unchanged from scaffold):**

- `class AmqpConsumer implements Consumer`
  - `constructor(opts: ConnectionOptions, shutdownTimeoutMs?: number)` — extend constructor to accept an optional timeout (decision doc default 30s).
  - `consume<T>(options, handler): Promise<void>`
  - `shutdown(): Promise<void>`

**Private state:**

- `conn: AmqpConnection`
- `channel: Channel | null`
- `consumeTag: string | null` (result of `channel.consume`)
- `inFlight: Set<symbol>` (one symbol per message being processed — Set so we can count and check empty)
- `inFlightTimers: Set<NodeJS.Timeout>` (backoff timers scheduled via setTimeout — must be cleared on shutdown)
- `shuttingDown: boolean`
- `closed: boolean`
- `currentOptions: ConsumerOptions | null` (remember for reconnect re-declare)
- `currentHandler: Handler<unknown> | null`
- `shutdownTimeoutMs: number` (default 30_000)

**Methods — plain language:**

- `consume(options, handler)`:
  1. Reject if `shuttingDown` or `closed`.
  2. Store `options` and `handler` on instance. v0.1.0 supports **one active consume per instance** (simpler; each caller spins a new `AmqpConsumer` if they need multiple queues).
  3. Call `assertTopology(options)` (see below).
  4. Open channel if not open. Set `prefetch(options.prefetch ?? 10)`.
  5. Register `conn.onReconnect(() => this.reestablish())` — on reconnect, re-run `assertTopology` and re-open consume tag.
  6. Call `channel.consume(queue, msg => this.handleMessage(msg), { noAck: false })`. Store returned `consumerTag`.

- `assertTopology(options)`:
  1. `channel.assertExchange(options.exchange, 'topic', { durable: true })`.
  2. `channel.assertExchange(DLX, 'topic', { durable: true })`.
  3. `channel.assertQueue(options.queue, { durable: true, exclusive: false, autoDelete: false })`.
  4. `channel.assertQueue(${options.queue}.dlq, { durable: true })`.
  5. `channel.bindQueue(options.queue, options.exchange, options.routingKey)`.
  6. `channel.bindQueue(${options.queue}.dlq, DLX, options.routingKey)` — DLX is topic, preserves original routing key.

- `handleMessage(msg)`:
  1. If `msg === null` → broker canceled consumer (e.g. queue deleted); log and bail.
  2. Mark in-flight: generate symbol, add to `inFlight`.
  3. Parse `attempt` from `msg.properties.headers['x-bms-attempt']` (default 1 if absent).
  4. Parse payload: `JSON.parse(msg.content.toString('utf8'))`. On parse error → see Traps §4.4 (send to DLQ with a `x-bms-parse-error` header, ack original).
  5. Build `MessageContext`: `{ attempt, headers: coerceHeaders(msg.properties.headers), routingKey: msg.fields.routingKey, queue: options.queue }`. (`coerceHeaders` — see Traps §4.5.)
  6. Invoke handler in a try/catch wrapper:
     - Result `'ack' | undefined` → `channel.ack(msg)`.
     - Result `'requeue'` → `channel.nack(msg, false, true)` (requeue immediate, **don't** increment attempt).
     - Result `'nack'` OR thrown error → decide retry vs DLQ (see below). Capture the error message for DLQ headers.
  7. Always remove the in-flight symbol in `finally` (after ack/nack/DLQ complete).

- `retryOrDlq(msg, attempt, firstError, lastError, options)`:
  - If `attempt >= (options.maxRetries ?? 5)` → `publishToDlq`, ack original. Done.
  - Else → `channel.ack(msg)` (ack the original so prefetch slot is freed), compute `computeBackoffMs(attempt + 1, base, max)`, schedule via `setTimeout` that re-publishes the original content to the **main exchange** with the same routing key and incremented `x-bms-attempt` header plus `x-bms-first-error` preserved. The timer handle is tracked in `inFlightTimers`; the in-flight symbol stays set until the re-publish confirms OR shutdown drains it.
  - **Alternative seriously considered and rejected:** `nack(msg, false, false)` + republish — causes the original to drop on the floor if shutdown lands between ack-decision and republish. Acking the original and republishing through the publisher path keeps "message is always either in-flight or durable in the exchange" invariant.

- `publishToDlq(msg, attempt, firstError, lastError)`:
  - Publish to `DLX` exchange, preserving original `routingKey`, with headers `{...original, 'x-bms-attempt': attempt, 'x-bms-first-error': firstError, 'x-bms-last-error': lastError}` and `persistent: true`.
  - Use `channel.publish` + `channel.waitForConfirms` only if the consumer channel is a ConfirmChannel — **simpler: open a dedicated ConfirmChannel for DLQ publishes in `assertTopology` and reuse**. This avoids mixing consume + publish confirms on one channel. Call it `dlqChannel`.

- `shutdown()`:
  1. Idempotent: if already `shuttingDown`, return the in-flight shutdown promise.
  2. Set `shuttingDown = true`.
  3. `await channel.cancel(consumeTag)` — stop receiving new msgs. Existing in-flight continue.
  4. Race in-flight drain vs timeout: `Promise.race([waitInFlightEmpty(), timeout(shutdownTimeoutMs)])`.
     - `waitInFlightEmpty`: polls `inFlight.size === 0` and `inFlightTimers.size === 0` via a short loop with setImmediate, OR uses a Promise that resolves when the last symbol is removed (preferred — maintain a resolver ref updated each time inFlight shrinks).
  5. On drain success: close `channel` and `dlqChannel`, close `conn`. Log clean shutdown.
  6. On timeout: clear all `inFlightTimers` (they'd misfire post-close); force-close connection — unacked msgs return to queue as "ready" automatically per AMQP semantics. Log forced shutdown. Resolve (don't reject — caller's SIGTERM handler shouldn't crash).
  7. Set `closed = true`.

**Edge cases:**

- Channel error mid-handler: channel-level errors invalidate all unacked deliveries on that channel. Re-establish channel via `reestablish()`, treat in-flight msgs as "will be redelivered automatically" — log as warning. Clear `inFlight` (broker will redeliver with same redelivered flag; our attempt tracking is header-based so continuity is preserved).
- Handler runs forever: no timeout enforced by lib in v0.1.0 (doc doesn't specify). Caller is responsible. Flag this in README as a known limitation.
- Duplicate `consume()` calls on same instance: reject with `ConsumerAlreadyActiveError`.
- `shutdown()` called before `consume()`: just close connection; fast path.

### 1.5 `src/index.ts` (MINOR EDIT)

Add one line to re-export `computeBackoffMs` from `retry.ts` for testability / advanced consumers that want to know the backoff schedule. Otherwise unchanged.

### 1.6 Test files (NEW)

- `src/retry.spec.ts` — unit tests for `computeBackoffMs`.
- `src/publisher.spec.ts` — unit tests with `amqplib` mocked at module level (`jest.mock('amqplib')`).
- `src/consumer.spec.ts` — unit tests, same mocking approach.
- `test/integration/end-to-end.integration.spec.ts` — testcontainers; RabbitMQ 3.13-management.
- `jest.integration.config.js` — points at `test/integration/**/*.integration.spec.ts`, longer timeout (60s), separate from unit config.

---

## 2. Testing strategy

### 2.1 Unit tests (fast, mocked, run on every save)

**`retry.spec.ts` — 7 cases**

- attempt=1 → baseMs
- attempt=2 → baseMs\*2
- attempt=5, base=1000, max=60000 → 16000
- attempt=20 → capped at maxMs
- attempt=0 → baseMs (guard)
- base=0 → 0
- max < base → maxMs
- _Covers AC:_ "backoff exponencial base \* 2^attempt capped em backoffMaxMs" from decision doc.

**`publisher.spec.ts` — ~10 cases**

- Happy path: `publish()` calls `assertExchange` once, `publish` with correct args, `waitForConfirms`, resolves.
- Second publish to same exchange: no second `assertExchange` call.
- `persistent` default true; explicit false honored.
- Headers merged and forwarded.
- JSON.stringify failure (bigint payload) → promise rejects, no broker call.
- `waitForConfirms` rejection → `publish` rejects.
- `close()` after `publish` → channel + connection closed; second `close()` no-op.
- `publish` after `close()` → rejects.
- Channel close event → next publish opens new channel + re-asserts.
- Concurrent first publishes → only one `assertExchange` call (race guard).
- _Covers AC:_ "Publisher declared with confirm mode, asserts exchange, serializes JSON, returns only on broker ack" (EVO-940 Given/When/Then #1, #2).

**`consumer.spec.ts` — ~15 cases**

- `consume()` asserts exchange + DLX + queue + DLQ + both bindings in order.
- `prefetch` applied with default 10; explicit override respected.
- Handler returns `'ack'` → `channel.ack` called.
- Handler returns `undefined` → `channel.ack` called (undefined == ack per decision doc).
- Handler returns `'nack'` → ack original + setTimeout scheduled + republish with `x-bms-attempt=2`.
- Handler throws → same retry path as `'nack'`; `firstError` header captures error message.
- Handler returns `'requeue'` → `channel.nack(msg, false, true)` + attempt NOT incremented.
- attempt reaches maxRetries → `publishToDlq` called with correct headers + ack original; no further scheduling.
- `x-bms-first-error` preserved across retries (first failure wins).
- `x-bms-last-error` updated each retry.
- Parse error (invalid JSON content) → routes to DLQ with `x-bms-parse-error` header; original acked; handler NOT invoked.
- Headers coerced: Buffer → string; numbers stay numbers.
- `shutdown()` cancels consume tag, drains single in-flight msg, closes channel + conn.
- `shutdown()` with in-flight hanging past timeout → force-close, timers cleared, resolves (doesn't reject).
- Reconnect fires `onReconnect` → topology re-asserted + consume tag re-opened; existing in-flight symbols cleared.
- Double `consume()` → rejects.
- _Covers AC:_ "Consumer declares topology, retries with backoff, lands in DLQ on max retries, graceful shutdown drains in-flight" (EVO-940 G/W/T #3, #4, #5, #6).

### 2.2 Integration tests (testcontainers, run nightly + pre-PR)

**`end-to-end.integration.spec.ts`** — boots `rabbitmq:3.13-management` once via testcontainers `beforeAll`, tears down in `afterAll`. Tests share the container; each test uses a unique queue name suffix to avoid cross-test pollution.

- **T1 — publish→consume roundtrip.** Publisher sends, Consumer receives, handler returns ack, queue empties. Assert latency <1s (local). _AC: EVO-940 "E2E happy path"._
- **T2 — retry exhausted → DLQ.** Handler always throws. After `maxRetries=3` attempts, message appears in `<queue>.dlq` with `x-bms-attempt=3`, `x-bms-first-error`, `x-bms-last-error` headers. Use management API or a second Consumer against the DLQ to assert. _AC: EVO-940 "DLQ on poison pill"._
- **T3 — requeue doesn't increment.** Handler returns `'requeue'` three times then `'ack'`. Assert all four deliveries carry `attempt=1`. _AC: "rate-limit semantics"._
- **T4 — graceful shutdown drains in-flight.** Publish 5 msgs. Handler sleeps 500ms. Call `shutdown()` while msgs are being handled. Assert: all 5 acked before shutdown resolves; no msgs lost; broker queue is empty. _AC: EVO-940 "SIGTERM in-flight"._
- **T5 — shutdown timeout fallback.** Handler sleeps 60s (longer than shutdown timeout 2s). Call `shutdown()`. Assert: resolves within ~2s, connection forcibly closed, unacked msgs are redelivered on fresh consumer. _AC: "shutdown timeout fallback"._
- **T6 — reconnect after broker bounce.** Start publisher + consumer, stop the container, restart it. Publish a msg. Assert it's received. Skipped by default if `SKIP_FLAKY=1` env is set — restarts with testcontainers are slow/flaky and this is a nice-to-have, not in the AC list.

**Rationale for T6 being optional:** EVO-940 AC list doesn't explicitly require reconnect-tested-by-integration. The unit test for `AmqpConnection.onReconnect` wiring is sufficient for the contract.

### 2.3 Acceptance-criteria mapping summary

| EVO-940 Given/When/Then             | Unit covers                                | Integration covers |
| ----------------------------------- | ------------------------------------------ | ------------------ |
| Publisher confirms before resolving | publisher.spec (waitForConfirms rejection) | T1                 |
| Consumer asserts topology           | consumer.spec (topology ordering)          | T1, T2             |
| Retry with backoff                  | retry.spec + consumer.spec (retry path)    | T2                 |
| DLQ headers on max-retries          | consumer.spec (publishToDlq args)          | T2                 |
| Requeue doesn't increment           | consumer.spec                              | T3                 |
| Graceful shutdown drains            | consumer.spec (drain resolver)             | T4                 |
| Shutdown timeout → forced close     | consumer.spec                              | T5                 |
| E2E latency <1s local               | —                                          | T1                 |

---

## 3. Six-day sequencing (2026-04-22 → 2026-04-28)

Critical path: Publisher consumable end of **2026-04-27** (day 6) so EVO-943 piloto can start 2026-04-29. Integration tests slip to day 6 if needed — they don't block piloto adoption.

| Day        | Date      | Deliverable                                                                                                                                                                                           | Rationale                                                                                                                                            |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**      | Wed 04-22 | `retry.ts` + `retry.spec.ts` passing. Scaffold `connection.ts` structure + unit skeleton.                                                                                                             | Pure function ships fastest; warms up the test pipeline; unblocks Consumer work on day 3.                                                            |
| **2**      | Thu 04-23 | `connection.ts` complete + tested (mocked amqplib). `publisher.ts` filled in (confirm channel, lazy assert, serialize, publish).                                                                      | Publisher uses Connection — do them together. By EOD a Publisher instance can publish end-to-end against a local RabbitMQ run manually.              |
| **3**      | Fri 04-24 | `publisher.spec.ts` complete and green. Davidson veto deadline EOD — if he pushes back on nomenclature, scope creeps here (accept up to 1 day slip).                                                  | Publisher fully unit-tested. Matches Davidson's veto window so any naming change can be absorbed before Consumer depends on exchange/queue patterns. |
| **4**      | Sat 04-25 | `consumer.ts` — topology assertion, handleMessage, retry path, DLQ publish. No shutdown yet. Partial `consumer.spec.ts`.                                                                              | Core consume loop first. Shutdown is orthogonal and goes on day 5.                                                                                   |
| **5**      | Sun 04-26 | `consumer.ts` shutdown + reconnect wiring. `consumer.spec.ts` complete and green. `index.ts` export adjustment. `jest.integration.config.js` scaffolded.                                              | All unit tests green; library is feature-complete from a unit standpoint. Piloto team could start against the package on Monday.                     |
| **6**      | Mon 04-27 | Integration tests T1–T5 (T6 optional). README updated with "known limitations" section (handler timeout, single-consume-per-instance). Package builds cleanly (`pnpm --filter @bms/messaging build`). | Day 6 is polish + integration. Piloto can start 04-29 against green CI.                                                                              |
| **Buffer** | Tue 04-28 | Flex day: Davidson feedback, integration test flakes, docs.                                                                                                                                           | Solo dev, 6-day window has to include buffer — don't schedule work here.                                                                             |

### Parallelizable vs sequential

**Strictly sequential:**

- retry.ts → consumer.ts (retry used inside handleMessage)
- connection.ts → publisher.ts → consumer.ts (both classes depend on AmqpConnection)
- Unit tests of each file → integration tests (integration reuses the same class, no reason to bypass unit gates)

**Parallelizable (same day, different dev sessions):**

- Day 2: Publisher source code and its test scaffolding (stub + mocks) can go side-by-side; tests green by day 3.
- Day 4+5: Consumer impl and consumer tests can interleave per-feature (topology test first, then retry test, etc.) — classic TDD.
- Day 6: Integration T1 (happy path) and T2 (DLQ) are independent; can be written in any order. T4+T5 (shutdown) reuse the same harness — write them together.

---

## 4. Traps addressed

### 4.1 Publisher confirms with high throughput

**Decision:** **Per-publish `waitForConfirms` for v0.1.0.** Simple, correct, matches decision-doc semantics ("`publish()` resolves when broker acks"). Cost is one network round-trip per publish — acceptable for the "millions msgs/month per app" envelope from the decision doc. Batched confirms (promise-per-publish tracked via `nack`/`ack` events on ConfirmChannel) cuts RTT cost 10-100x but complicates error attribution. **Revisit trigger:** if any app measures publish latency >50ms steady-state in production, file a v0.1.x issue to switch to batched.

### 4.2 Connection loss during in-flight consume

**Decision:**

- Channel error mid-handler → treat msg as lost-to-broker-redelivery. Our `inFlight` tracking is dropped on channel close. Broker redelivers with `redelivered=true` flag and same attempt header, so counts stay correct.
- Connection drop mid-handler → same as channel error (all channels die with connection). `AmqpConnection` auto-reconnects with backoff; `onReconnect` listener in `AmqpConsumer` re-runs `assertTopology` + `channel.consume`. In-flight handlers that complete successfully **after reconnect** will try to ack on a dead channel — the ack call will throw. Wrap ack/nack in try/catch and log as warning (broker will redeliver, no correctness violation).

### 4.3 Memory retention of in-flight counters during shutdown

**Decision:**

- In-flight tracking via `Set<symbol>` + a resolver ref. When `shutdown()` is called, install a resolver that completes when the set goes empty; in `handleMessage`'s finally, after removing the symbol, if the set is empty AND `shuttingDown`, resolve.
- Timeout path: clear all backoff timers (`for (const t of inFlightTimers) clearTimeout(t)`) — these scheduled republishes would fire on a closed channel and throw. Forcibly close connection. Orphaned `inFlight` symbols are garbage-collected with the AmqpConsumer instance.
- Default timeout 30s (decision doc). Configurable via constructor.

### 4.4 Parsing errors (message body is not valid JSON)

**Not in decision doc. Propose:** **Publish to DLQ with `x-bms-parse-error` header, ack original. Do NOT invoke handler.**

**Justification:**

- Can't `nack+retry` because re-delivering the same bad bytes will fail the same way forever → infinite loop.
- Can't `ack` silently → silent data loss; operators won't know.
- DLQ makes the bad message visible, operators can inspect it, and the consumer stays healthy. This matches the established "poison pill → DLQ" pattern.
- Header distinguishes parse failure from handler-exhaustion failure for DLQ triage.

### 4.5 Header type coercion (Buffer → primitives)

**Decision:** Implement `coerceHeaders(raw: Record<string, any>): Record<string, unknown>` helper inside `consumer.ts`.

- Buffer → `buf.toString('utf8')`.
- Arrays (amqplib allows header arrays) → recursively coerce elements.
- Numbers, strings, booleans → passthrough.
- Everything else → passthrough as-is (typed `unknown` in the context, caller's problem).
  Applied once per incoming message when building `MessageContext.headers`. This is the only shape conversion the lib does — rest stays opaque.

---

## 5. Non-goals

Explicitly **out of scope** for this implementation. Do NOT extend without a new issue:

- **Per-service retry queues** (`.retry` queue with TTL + DLX back to main). Ruled out by decision doc for v0.1.0; in-process `setTimeout` retry is the chosen mechanism.
- **Exchange versioning** (`bms.email.v1`). Deferred to v0.2. Current EXCHANGES const has no version suffix and that's intentional.
- **Circuit breaker.** EVO-940 mentions the phrase but Checkpoint 1 list is narrower ("Publisher + Consumer + bridge HTTP double retry + DLQ + graceful shutdown"). Circuit breaker is a separate issue.
- **HTTP bridge.** Consuming app (EVO-943) owns the Consumer→HTTP loopback. The lib provides Consumer; the bridge is application code.
- **Multi-tenancy / vhost routing.** Single vhost assumed. `ConnectionOptions` has `url` which includes vhost if needed.
- **Handler timeout enforcement.** If a handler hangs, it hangs. Caller responsibility. Document as known limitation.
- **Multiple `consume()` per AmqpConsumer instance.** One queue per instance; caller creates N instances for N queues. Keeps shutdown semantics clean.
- **Wildcard routing key bindings.** Decision doc: "não wildcards na v0.1.0". Queue binds to exact routing key.
- **Protobuf/Avro payload format.** JSON only, decision doc.
- **Publishing SDK metadata headers** (`x-bms-origin-service`, `x-bms-correlation-id`, etc.). Decision doc: headers are optional v0.1.0. Consumer-side `x-bms-attempt`/`x-bms-first-error`/`x-bms-last-error` are the only lib-added headers, and only on DLQ publishes.
