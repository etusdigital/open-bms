# sendgrid-mock

Stand-in for `api.sendgrid.com` used by BMS local development and CI. Implements
only the 14 v3 routes the BMS monorepo actually calls, plus three admin
endpoints for test orchestration. Single Go binary, no external deps, in-memory
state.

## Why this exists

EVO-1025 needed reproducible end-to-end validation of the SendGrid integration
(save credentials → webhook auto-creation → events flow back through
`event-receiver` → AMQP → `event-process`). Hitting the real SendGrid sandbox
requires internet, a real public webhook URL (ngrok), real email sends, and
non-deterministic open/click timing — none of which suits CI or repeated local
runs. The mock replaces SendGrid entirely so the whole loop runs offline in
docker-compose.

## What it implements

### SendGrid v3 routes (the only ones BMS calls — verified by grepping the monorepo)

| Method | Path                                      | BMS call site                                                         |
| ------ | ----------------------------------------- | --------------------------------------------------------------------- |
| GET    | `/v3/user/account`                        | `msgops-api/src/lib/sendgrid-validator.ts` (validate API key on save) |
| GET    | `/v3/user/webhooks/event/settings/all`    | `msgops-api` SendgridHandler.createWebhook                            |
| POST   | `/v3/user/webhooks/event/settings`        | idem                                                                  |
| PATCH  | `/v3/user/webhooks/event/settings/{id}`   | idem                                                                  |
| GET    | `/v3/send_ips/pools`                      | SendgridHandler.getSiloOptions                                        |
| GET    | `/v3/ips`                                 | SendgridHandler.getIPs / getIPsByAccount                              |
| GET    | `/v3/categories/stats`                    | SendgridHandler.getStatsByCategories + automations.service            |
| POST   | `/v3/marketing/singlesends`               | SendgridHandler.createSingleSend                                      |
| PUT    | `/v3/marketing/singlesends/{id}/schedule` | SendgridHandler.sendSingle                                            |
| GET    | `/v3/marketing/singlesends/{id}`          | SendgridHandler.getCampaignById                                       |
| DELETE | `/v3/marketing/singlesends/{id}/schedule` | SendgridHandler.unscheduleSingleSend                                  |
| PATCH  | `/v3/marketing/singlesends/{id}`          | SendgridHandler.updateSingleSend                                      |
| GET    | `/v3/verified_senders`                    | SendgridHandler.getVerifiedSenders                                    |
| POST   | `/v3/mail/send`                           | `msgops-api` + `send-email` (via `@sendgrid/mail`)                    |

Anything outside this list returns 404 by design — if BMS starts calling a new
SendGrid endpoint, the integration test fails loudly instead of silently
skipping coverage.

### Admin / test orchestration

| Method | Path            | Purpose                                                                                                                                        |
| ------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/__mock/fire`  | Manually fire arbitrary events at the registered webhook (or any URL via `target` override). Body: `{"events":[{...}], "target":"http://..."}` |
| GET    | `/__mock/state` | Snapshot of webhooks / single-sends / received mails / fired events. For test asserts.                                                         |
| POST   | `/__mock/reset` | Clear all in-memory state                                                                                                                      |
| GET    | `/healthz`      | `{"status":"ok"}`                                                                                                                              |

### Auto-fire on `/v3/mail/send`

When the mock receives `POST /v3/mail/send`, it asynchronously fires four
synthetic events at the registered webhook URL, in order:

```
processed → delivered → open → click
```

Spaced by `MOCK_EVENT_DELAY_MS` (default 500ms). The recipient and category[]
are extracted from the mail payload so downstream processors that key on those
fields see realistic data. Use `/__mock/fire` to test other event types
(bounce, dropped, spam*report, unsubscribe, deferred, group*\*).

## Environment

| Var                   | Default | Purpose                          |
| --------------------- | ------- | -------------------------------- |
| `PORT`                | `3010`  | Listen port                      |
| `MOCK_EVENT_DELAY_MS` | `500`   | Spacing between auto-fire events |

## Running standalone

```bash
go run ./apps/sendgrid-mock
# or
docker compose up sendgrid-mock
```

Smoke test:

```bash
curl http://localhost:3010/healthz
curl http://localhost:3010/v3/user/account
```

## End-to-end flow under docker-compose

`docker-compose.yml` ships defaults that route the whole stack at the mock:

- `msgops-api` env `SENDGRID_API_BASE_URL=http://sendgrid-mock:3010`
- `msgops-api` env `SENDGRID_WEBHOOK_URL_BASE=http://event-receiver:3011/bms/events?platform=sendgrid`
- `send-email` env `SENDGRID_API_BASE_URL=http://sendgrid-mock:3010`

So the loop is:

```
msgops-api  ──/v3/...──▶  sendgrid-mock
                              │
                              │ (on /v3/mail/send) schedule events
                              ▼
                         event-receiver:3011/bms/events?platform=sendgrid&account=N
                              │
                              │ publish AMQP routing key event.received.sendgrid
                              ▼
                         event-process consumer ──HTTP loopback──▶  /internal/event/sendgrid
```

To opt out (talk to real SendGrid instead), set
`SENDGRID_API_BASE_URL=https://api.sendgrid.com` and
`SENDGRID_WEBHOOK_URL_BASE=<your public URL>` before
`docker compose up`.

## Validating EVO-1025 with the mock

```bash
# 1. Bring up the stack
docker compose up -d postgres redis rabbitmq clickhouse minio minio-bootstrap \
                   sendgrid-mock event-receiver event-process msgops-api

# 2. Wait for msgops-api to be healthy
docker compose ps msgops-api

# 3. Save a SendGrid key via the API (any string — mock accepts anything)
curl -X POST http://localhost:5001/account-settings \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"SG.MOCK_TEST_KEY"}'

# 4. Confirm webhook was registered against the mock
curl http://localhost:3010/__mock/state | jq .webhooks

# 5. Trigger a mail/send to fire synthetic events
curl -X POST http://localhost:3010/v3/mail/send \
  -H "Content-Type: application/json" \
  -d '{"personalizations":[{"to":[{"email":"test@bms.local"}]}],"categories":["account_1","campaign_1"]}'

# 6. Confirm events fired and were accepted by event-receiver
curl http://localhost:3010/__mock/state | jq '.fired[] | {target, status, "event": .payload.event}'

# 7. Confirm events landed in BMS (clickhouse / pg, depending on processor)
docker compose logs event-process | grep -i sendgrid | tail -20

# 8. Test edge cases via /__mock/fire (bounce, dropped, etc.)
curl -X POST http://localhost:3010/__mock/fire \
  -H "Content-Type: application/json" \
  -d '{"events":[{"email":"x@bms.local","timestamp":'$(date +%s)',"event":"bounce","sg_event_id":"abc","sg_message_id":"m1","bounce_classification":"Invalid Address","reason":"550 unknown recipient","status":"5.1.1","type":"bounce","category":["account_1"]}]}'

# 9. Reset between test runs
curl -X POST http://localhost:3010/__mock/reset
```

## Design notes

- **In-memory only.** Restart loses state — that's the point. Reset is the
  same operation as restart, only faster.
- **No signature verification.** SendGrid Signed Event Webhook isn't
  implemented because `event-receiver` doesn't verify it either (separate
  hardening issue; out of scope for the mock).
- **`max_allowed: 2`** matches real SendGrid's per-account webhook limit, so
  the idempotency path in `SendgridHandler.createWebhook` (list + PATCH match
  vs. POST new) is exercised the same way it would be in production.
- **Auto-fire order** is hard-coded `processed → delivered → open → click`
  because that's the canonical "happy path" sequence. Negative paths
  (bounce/drop/spam/unsubscribe) need explicit `/__mock/fire` so tests are
  forced to be intentional about asserting on them.
