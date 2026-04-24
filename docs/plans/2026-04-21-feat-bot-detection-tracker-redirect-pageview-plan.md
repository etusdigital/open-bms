# Bot detection for tracker-redirect and pageview events

**Date:** 2026-04-21
**Related:** `docs/plans/2026-04-20-bot-detection-mmdb-refactor.md`, `docs/plans/2026-04-20-ua-denylist-for-bot-detection.md`, branch `fix/bot-detection-grpc-casing`

## Context

Bot detection today stamps six fields into Kafka `properties` for every event that flows through `processMessageToKafka`:

- `is_bot` (narrow — scanner ASN on hosting OR script/bot UA on hosting)
- `is_datacenter` (wide — any hosting IP)
- `bot_classification` (`gmail_prefetch` / `outlook_prefetch` / `yahoo_prefetch` / `script_ua` / `datacenter` / `null`)
- `asn`, `asn_org`, `user_type` (forensic context)

The SendGrid path (hop 1 of the email click flow) already stamps these. We want the same coverage on hops 2 and 3 so ClickHouse `events_logs_v2` carries per-hop bot signals for forensic correlation:

```
hop 1: SendGrid click webhook                              → ip = Gmail/Outlook prefetcher (often bot)
hop 2: apps/tracker /redirect (tracker-redirect)           → ip = real user (platform='internal')
hop 3: external pageview service (pageview)                → ip = real user (platform='custom_events')
```

**Why it matters.** Prefetchers ping hop 1 but don't follow the 302, so hops 2–3 only fire for real humans. A message where hop 1 says bot but hops 2–3 arrive from a residential IP is a Gmail-prefetch-then-real-user — not a bot. Having per-hop bot flags in ClickHouse lets us cross-reference later via ad-hoc queries before deciding whether to build aggregation counters.

**Scope guardrail.** No Redis counters, no dashboards, no schema changes. Just make sure the six signals land in ClickHouse for hops 2–3 and prove it with verification queries. Aggregation can come later.

## Investigation findings

### Hop 2: tracker-redirect — already works end-to-end

- `apps/tracker/src/app.controller.ts:57` uses `@IpAddress()` which wraps `request-ip`. The library reads `X-Forwarded-For` directly and returns the first public IP — correct behavior on Cloud Run without any `trust proxy` setup.
- `apps/tracker/src/app.service.ts:86–100` — `publishRedirectClick` publishes to Pub/Sub with `platform: 'internal'`, `message_type: 'tracker-redirect'`, and `payload: [{ ip, userAgent, ... }]`. Gated by `ENABLE_TRACKER_REDIRECT_EVENT=true`.
- `apps/event-process/src/events/services/internal-events.service.ts:92–95,159` — calls `getGeoIpInfo(event.ip)` and spreads `geoData` (with `traits`) onto the EventLog. Then `sendKafkaMessage(eventsProcess)` routes through `processMessageToKafka` which classifies and stamps all six fields into `properties`.
- Postgres `saveEventsLogs` is commented out for internal events (line 171) — ClickHouse-only, no schema risk.

**Conclusion:** zero code change needed after the casing fix lands. The path already calls `BotDetector.classify` and stamps the snake_case fields into `properties`.

### Hop 3: pageview — already works end-to-end

- Pageview events come from an **external service** publishing directly to the Pub/Sub topic that `event-process` consumes (not through `apps/event-receiver`). The external service captures the end-user's IP server-side and places it in `ip` on every payload item. Sample payload includes `"ip": "189.153.175.193"` plus `userAgent` and full device/session context.
- `apps/event-process/src/events/services/custom-events.service.ts:91–93` reads `event.ip` per payload item — matches what the external service sends. `getGeoIpInfo` is called, `geoData` is spread onto the EventLog, `sendKafkaMessage` stamps bot signals into `properties`.
- `saveEventsLogs` is active for custom events (line 160) — and after the casing-fix PR, `prepareQuery` excludes `traits` via `EXCLUDED_COLUMNS`, so Postgres writes are safe too.

**Conclusion:** zero code change needed.

### Earlier hypothesis (`client_info.ip` fallback) — rejected

An earlier draft of this plan proposed reading `client_info.ip` as a fallback in `custom-events.service`. That was based on inspecting `apps/event-receiver` (which captures `X-Forwarded-For[0]` into `message.client_info.ip`). But pageview events don't flow through event-receiver — they come from the external service with `event.ip` already set. Adding a fallback would be unused defensive code. YAGNI; skipped.

## Changes

All changes live in `apps/event-process`. No production code changes — only regression tests and documentation.

### 1. Regression test for tracker-redirect bot-signal stamping

**File:** `apps/event-process/src/events/services/internal-events.service.spec.ts`

The existing spec covers `internalEventsProcess` broadly but doesn't explicitly assert bot-signal stamping. Add one focused test as a regression guard — it proves hop 2 bot detection works even though no production code change was required:

- **Test E** — `tracker-redirect` event with hosting IP → Kafka payload's `properties` has `is_bot: false`, `is_datacenter: true`, `bot_classification: 'datacenter'`, `asn: 396982`.
  - Mocks `getLocation` to return GCP hosting traits (`{asn: 396982, userType: 'hosting', ...}`).
  - Posts a single-event request with `platform: 'internal'`, `event: 'tracker-redirect'`, `ip: '8.8.8.8'`, `accountId: '1'`, `uuid: 'x'`.
  - Asserts `mockKafkaProvider.sendAsyncMessage` was called and the payload's `properties` contains the expected six snake_case fields.

- **Test F** — `tracker-redirect` with a Gmail-scanner IP and a `curl` UA → Kafka `properties.is_bot: true`, `bot_classification: 'gmail_prefetch'` (ASN-based classification wins over UA denylist, per existing BotDetector precedence).
  - Proves the full UA-denylist path also works through the internal-events handler.

- **Test G** — `tracker-redirect` with no `ip` → `getLocation` not called; Kafka `properties.is_bot: false`, `asn: 0`, `user_type: ''` (BotDetector's all-false defaults).

### 2. Regression test for pageview bot-signal stamping

**File:** `apps/event-process/src/events/services/custom-events.service.spec.ts`

Add one focused test mirroring the tracker-redirect coverage:

- **Test H** — `pageview` event with residential IP → Kafka `properties.is_bot: false`, `is_datacenter: false`, `bot_classification: null`, `user_type: 'residential'`, `asn: 28573`.
  - Mocks `findEvent` to return a custom event definition (pageview must exist in the DB for the service to process it).
  - Mocks `getLocation` with residential traits.
  - Posts a single-event request mirroring the real external-service payload shape (keep it minimal — only the fields the handler reads: `apiKey`, `event: 'pageview'`, `ip`, `userAgent`, `uuid`).
  - Asserts the stamped properties.

- **Test I** — `pageview` with hosting IP + `curl` UA → `is_bot: true`, `bot_classification: 'script_ua'`. Proves the UA denylist also kicks in on the custom-events path.

## Verification (post-deploy on staging)

Run after the casing-fix PR (`fix/bot-detection-grpc-casing`) **plus** these regression tests land.

1. **Hop 1 regression sanity** — confirm the casing fix actually unbroke click classification:

   ```sql
   SELECT
     date,
     count() AS total,
     countIf(properties.is_bot::Bool) AS bots,
     countIf(properties.is_datacenter::Bool) AS datacenter,
     countIf(properties.user_type::String = 'hosting') AS hosting
   FROM events_logs_v2
   WHERE time_date >= today() - 1
     AND event = 'click'
     AND message_type = 'email'
   GROUP BY date
   ORDER BY date DESC;
   ```

   Expect non-zero `bots` and `datacenter`. Before the fix all three were zero.

2. **Hop 2 coverage** — tracker-redirect events should carry populated bot signals:

   ```sql
   SELECT
     count() AS total,
     countIf(properties.is_bot::Bool) AS bots,
     countIf(properties.user_type::String != '') AS with_user_type
   FROM events_logs_v2
   WHERE time_date >= today() - 1
     AND message_type = 'internal'
     AND event = 'tracker-redirect';
   ```

   `with_user_type` should be ~100% of `total`. A large empty-rate means either `ENABLE_TRACKER_REDIRECT_EVENT` is off in the tracker Cloud Run env, or the IP isn't reaching `event-process` (check the pubsub payload).

3. **Hop 3 coverage** — pageviews should carry populated bot signals:

   ```sql
   SELECT
     count() AS total,
     countIf(properties.is_bot::Bool) AS bots,
     countIf(properties.user_type::String != '') AS with_user_type
   FROM events_logs_v2
   WHERE time_date >= today() - 1
     AND message_type = 'custom_events'
     AND event = 'pageview';
   ```

   Same expectation: `with_user_type` ~100% of `total`.

4. **Payoff query — Gmail-prefetch-then-real-user pattern.** Correlate hop 1 bot-flagged clicks with subsequent human tracker-redirects for the same `(account_id, contact_id, message_id)`:
   ```sql
   WITH
     bot_clicks AS (
       SELECT account_id, contact_id, message_id, time AS click_time
       FROM events_logs_v2
       WHERE time_date >= today() - 1
         AND event = 'click'
         AND message_type = 'email'
         AND properties.is_bot::Bool = true
     ),
     followups AS (
       SELECT account_id, contact_id, message_id, time AS redirect_time,
              properties.is_bot::Bool AS redirect_is_bot,
              properties.user_type::String AS redirect_user_type
       FROM events_logs_v2
       WHERE time_date >= today() - 1
         AND event = 'tracker-redirect'
     )
   SELECT count() AS bot_clicks_with_human_followup
   FROM bot_clicks b
   INNER JOIN followups f USING (account_id, contact_id, message_id)
   WHERE f.redirect_time > b.click_time
     AND f.redirect_is_bot = false
     AND f.redirect_user_type IN ('residential', 'cellular', 'business');
   ```
   A non-trivial count here is proof-of-value: those are Gmail-prefetch-then-real-user clicks currently counted as bots. If this number is material we can refine `bot_click` semantics to require no human follow-up within N minutes.

## Out of scope

- **Redis aggregation counters** (`bot_tracker_redirect`, `bot_pageview`). Defer until the ClickHouse data validates the signal.
- **Backoffice UI / dashboards.**
- **ClickHouse schema changes.** Six signals ride on the existing `properties` JSON column.
- **`client_info.ip` fallback in custom-events.** Not needed (see Investigation above).
- **`apps/tracker`, `apps/event-receiver`, `apps/geolocation`.** No changes.

## Effort estimate

- Tests: ~1 hour.
- Verification: ~1 hour of ClickHouse queries post-deploy, spread over a day to let data accumulate.

## Risk & rollback

- Test-only additions. Zero runtime risk.
- Casing-fix PR is the dependency; if that gets reverted, these tests still pass (they exercise the post-fix behavior of the BotDetector pipeline).

## Follow-ups (separate PRs, after validation)

1. Redis click-style aggregation (`bot_tracker_redirect`, `datacenter_tracker_redirect`, `bot_pageview`) once the data looks meaningful.
2. A materialized view joining the three hops per `(account_id, contact_id, message_id)` for fast "real engagement" queries.
3. A "real click rate" metric in the backoffice, computed as `tracker_redirects / delivered` to strip prefetch noise.
