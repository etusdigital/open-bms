# Open BMS — Anonymous Telemetry

Open BMS emits anonymous, aggregated telemetry to help the Etus team understand adoption, version distribution and rough feature usage. This document describes exactly what is collected, what is **not**, and how to disable it.

## Quick switch

```bash
# Disable explicitly:
ETUS_TELEMETRY_ENABLED=false

# Or use the universal flag (takes precedence):
DO_NOT_TRACK=1
```

The msgops-api also auto-detects CI environments (`CI=true`, `GITHUB_ACTIONS=1`, etc.) and turns telemetry off there.

## What is collected

Two event types, both anonymous:

### `instance.lifecycle` (type=install)

Emitted **once** when the setup wizard completes. Re-emission is no-op (idempotent).

- `schema_version` (semver)
- `event_id` (UUID)
- `timestamp` (ISO 8601)
- `product.name` = `"open-bms"`
- `product.version` (semver of msgops-api)
- `instance.id` — SHA-256 base32 of `seed || install_uuid || product_name`. The seed lives only on the instance's filesystem; Etus servers cannot reverse it.
- `instance.first_seen_at` (ISO 8601)
- `lifecycle.type` = `"install"`
- `lifecycle.from_version` = `null`
- `lifecycle.to_version` = current product version
- `lifecycle.feature` = `null`

### `instance.heartbeat`

Emitted every 24h (with ±1h random jitter).

- All envelope fields from above
- `environment.os` — one of `linux`/`macos`/`windows`/`unknown`
- `environment.arch` — one of `x86_64`/`arm64`/`unknown`
- `environment.runtime` = `"node"`
- `environment.runtime_version` (e.g., `"20.11.1"`)
- `environment.deployment` — one of `docker`/`kubernetes`/`native`/`unknown`
- `environment.is_containerized` (boolean)
- `database.engine` = `"postgres"`
- `database.version_major` (e.g., `"16"`)
- `usage.active_users` — non-negative integer count
- `usage.accounts` — non-negative integer count

## What is **NOT** collected

The official SDK enforces a strict whitelist. Even if a future contributor accidentally tries to send these fields, the SDK builders will drop them. We also have an automated test (`telemetry.privacy.spec.ts`) that explicitly asserts:

- ❌ No e-mails (including the admin owner email — see below)
- ❌ No IP addresses (yours or your users')
- ❌ No hostnames or MAC addresses
- ❌ No user names
- ❌ No message content, contact data, campaign content
- ❌ No license IDs, API keys, env vars, git remotes

## About the admin owner email

When you create the first admin account in the setup wizard, that e-mail is stored **locally** in the `system_config.telemetry_state.account_owner_email` row. This is for **your records only** — it lets you identify which operator activated the instance. It is **never** sent to `otw.etus.dev`. The privacy test enforces this.

## Where the data goes

`https://otw.etus.dev` (configurable via `ETUS_TELEMETRY_ENDPOINT`). Aggregated, anonymized data is published publicly at [telemetry.etus.dev](https://telemetry.etus.dev). See the [privacy policy](https://telemetry.etus.dev/privacy) for the controller's stated retention and access policies.

## How it works internally

- Initialization: `apps/msgops-api/src/main.ts` calls `TelemetryService.initOnBootstrap()` before `app.listen()`.
- Install: `SetupService.completeWizard()` calls `TelemetryService.emitInstall()` after marking `setup_complete`.
- Backfill: `AuthService.login()` calls `TelemetryService.maybeBackfillInstall(user)` (fire-and-forget); only super-admins trigger backfill on instances configured before this feature existed.
- Heartbeat: a `setTimeout` armed in `onApplicationBootstrap` fires every 24h ± 1h jitter and persists `last_heartbeat_at` / `last_heartbeat_status` in `system_config.telemetry_state`.
- Failure modes: every telemetry call is wrapped in try/catch. **No telemetry failure can break the app or block login.**

## Auth0 deployments

For `AUTH_PROVIDER=auth0`, the backfill hook in `AuthService.login()` is not reached (Auth0 bypasses local login). The install lifecycle is still emitted on `completeWizard()`. If you migrate an Auth0 instance from a pre-telemetry version, the install will be emitted at the next setup wizard run (or you can manually call the endpoint via SQL: `INSERT INTO system_config (key, value) VALUES ('telemetry_state', '{"install_emitted_at": null}'::jsonb) ON CONFLICT DO NOTHING;` and restart).

## Removing telemetry entirely

If you want to remove telemetry from your fork:

1. Remove `apps/msgops-api/src/modules/telemetry/`
2. Remove the `TelemetryModule` import from `app.module.ts`, `setup.module.ts`, `auth.module.ts`
3. Remove the `TelemetryService.initOnBootstrap()` call from `main.ts`
4. Remove the `telemetry.setOwnerEmail` / `telemetry.emitInstall` / `telemetry.maybeBackfillInstall` calls in `setup.service.ts` and `auth.service.ts`
5. Remove `@etus/telemetry-sdk` from `apps/msgops-api/package.json`
6. `pnpm install`

Setting `ETUS_TELEMETRY_ENABLED=false` already achieves the runtime equivalent (no network traffic).
