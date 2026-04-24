# Trailing-Slash on Outbound URLs for Internal Accounts

**Date:** 2026-04-17
**Status:** Design validated, ready for implementation plan
**Owner:** Filipe

## Problem

URLs sent to end users through our messaging services (email, push, WhatsApp, SMS/Twilio) lack a canonical trailing slash on the path portion. This causes SEO and analytics inconsistencies for landing pages, since `example.com/lp` and `example.com/lp/` are indexed and tracked as distinct URLs.

The fix applies only to **internal accounts** (Etus's own properties); external customer accounts must not have their URLs modified.

## Scope

In: `send-email`, `send-push`, `send-whatsapp`, `twilio-messaging`.
Out of scope: `msgops-api` or `message-trigger` URL bodies; we enrich their Pub/Sub publish payloads only.

## Solution Overview

1. A new shared package `@msgops/url-utils` exposes one pure function, `addTrailingSlash(url: string): string`, that canonicalises the URL path.
2. Publishers (`msgops-api`, `message-trigger`) include `account.isInternal` on the Account object they already embed in Pub/Sub messages.
3. Each send service's `Account` interface gains an optional `isInternal?: boolean` field.
4. Each send service applies `addTrailingSlash()` at its single URL-finalization point, gated on `account.isInternal`.

## Package: `@msgops/url-utils`

### Location

`packages/url-utils/` — mirrors the layout of `packages/shared/` (tsconfig, jest, tsup/tsc build, `dist/` output, `@msgops/url-utils` name in `package.json`).

### API

```ts
export function addTrailingSlash(url: string): string;
```

Pure function. No side effects. No account or domain knowledge — the gating decision lives in callers.

### Behaviour (decision table)

| Input condition                                       | Action                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| Scheme is `mailto:`, `tel:`, `sms:`, or `javascript:` | return unchanged                                                                |
| URL fails to parse                                    | return unchanged                                                                |
| Path portion (before first `?` or `#`) contains `{{`  | return unchanged                                                                |
| Path already ends with `/`                            | return unchanged                                                                |
| Path has a segment AND last segment ends with `.ext`  | return unchanged (file-extension skip only applies when a path segment exists)  |
| Otherwise                                             | insert `/` immediately before the first `?` or `#`, or append if neither exists |

### Algorithm

Operate on the URL as a string. Split into `[pathPart, separator, rest]` where `separator ∈ {'?', '#', ''}`. Apply the skip rules to `pathPart`. Reassemble by concatenation. **Do not** round-trip through `new URL()` for reconstruction — that would re-encode templated query parameters and risk corrupting placeholders such as `{{contact.email}}`.

**Bare-host carve-out.** The file-extension check (`\.[A-Za-z0-9]{1,8}$`) is only applied when the `pathPart` contains a `/` _after_ the `://` (i.e., there is at least one path segment). Without this guard, the regex would match the host's own TLD on bare hosts like `https://example.com`, `https://example.dev`, or multi-TLD hosts like `https://example.com.br` and `https://subdomain.domain.com.br` — incorrectly skipping them. The carve-out ensures bare hosts always receive a trailing slash, and the regex only sees path-last-segment content on URLs that actually have a path.

### Examples

| Input                                           | Output                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `https://example.com/lp?utm_source=x`           | `https://example.com/lp/?utm_source=x`                                    |
| `https://example.com/lp/?utm_source=x`          | `https://example.com/lp/?utm_source=x` (unchanged)                        |
| `https://example.com/lp#section`                | `https://example.com/lp/#section`                                         |
| `https://example.com/lp?utm=x#section`          | `https://example.com/lp/?utm=x#section`                                   |
| `https://example.com/brochure.pdf?utm=x`        | `https://example.com/brochure.pdf?utm=x` (unchanged — extension)          |
| `https://example.com`                           | `https://example.com/`                                                    |
| `https://example.com/`                          | `https://example.com/` (unchanged)                                        |
| `https://example.com/profile?id={{contact.id}}` | `https://example.com/profile/?id={{contact.id}}` (template in query — ok) |
| `https://example.com/user/{{contact.id}}?utm=x` | unchanged (template in path — skip)                                       |
| `mailto:support@example.com`                    | unchanged                                                                 |

### Tests

Colocated `addTrailingSlash.spec.ts` with table-driven Jest cases covering every row above plus malformed inputs (empty string, non-URL text, missing scheme).

## Propagating `isInternal` through the pipeline

### Publisher changes

- `apps/msgops-api/src/modules/services/services.service.ts` — in `sendEmail()` and `sendMobilePush()` (and the WhatsApp/SMS equivalents), extend the Account payload with `isInternal: account.isInternal` sourced from the already-fetched account entity.
- `apps/message-trigger/...` — in `parseLeadStateMessageToSendEmailMessage()` and `parseLeadStateMessageToSendNotification()` (and the WhatsApp/SMS equivalents), forward `account.isInternal` from `leadStateMessage.account`.

### Consumer changes

- Add `isInternal?: boolean` to each service's local `Account` interface:
  - `apps/send-email/src/interfaces.ts`
  - `apps/send-push/src/interfaces.ts` (or equivalent)
  - `apps/send-whatsapp/src/interfaces.ts`
  - `apps/twilio-messaging/src/interfaces.ts`
- Default behaviour when absent: treat as `false` (external — no slash). This keeps in-flight messages from older publishers safe during rollout.

## Per-service integration points

Same pattern everywhere:

```ts
const finalUrl = account.isInternal ? addTrailingSlash(rawUrl) : rawUrl;
```

### send-email

`apps/send-email/src/mail/mail.utils.ts`, inside `createEmailPixel()`.
Existing code rebuilds each destination URL as `${url.origin}${decodeURI(url.pathname)}?${queryString}`. Apply `addTrailingSlash()` to that destination string **before** it is URL-encoded and injected into the `bmsclick.${domain}/redirect?url=...` tracking wrapper. The bmsclick wrapper URL itself is not modified. Unsubscribe links and the open-pixel are skipped at this call site (they are inserted by send-email, not sourced from user HTML, and the extension rule already short-circuits the pixel).

### send-push

`apps/send-push/src/app.service.ts`, inside `addDefaultUTMs()`.
Apply after the existing `${url.origin}${url.pathname}?${queryString}` build, before persisting to the Firebase custom data.

### send-whatsapp

`apps/send-whatsapp/src/app.service.ts`, inside `createRedictLink()`.
Apply to the destination URL **before** `msgopsService.createShortLink(url, baseUrl)` is called. The short-link wrapper returned by msgops is not modified.

### twilio-messaging

`apps/twilio-messaging/src/app.service.ts`, inside `createRedictLink()`.
Same pattern as `send-whatsapp`.

## Testing strategy

- **Package** (`packages/url-utils`): exhaustive unit tests on the pure function. This is the bulk of the test coverage.
- **Each service**: one light spec that verifies the gated call — internal account → `addTrailingSlash` applied; external account → original URL passes through untouched. No need to re-test the utility's edge cases at this layer.

## Rollout order

1. Ship `@msgops/url-utils` package (no runtime effect).
2. Ship publisher changes (`msgops-api`, `message-trigger`) — adds `isInternal` to payload. Still no effect on consumers.
3. Ship consumer changes in all four send services.

The optional `isInternal?` field plus external-default behaviour makes each step independently deployable and reversible.

## Alternatives considered

- **Gate inside the package** (`addTrailingSlash(url, account)`): rejected. Couples a general URL utility to msgops account semantics and forces a misleading name. Gating in 4 one-liner call sites is cheaper and more flexible.
- **Skip URLs containing `{{` anywhere** (including query): rejected as over-conservative. Placeholders in query parameters are common (`?userId={{contact.id}}`); since we only modify the path portion, query-side templates are irrelevant to correctness.
- **Apply slash after variable substitution** in each service: rejected. Substitution is per-recipient in 4 different code paths; skip-on-path-template gives us the same safety with a single processing point.
- **Re-query `account.isInternal` in each consumer**: rejected. Extra DB hits in high-throughput send services, plus drift risk. The account object already rides on the message.
- **Add to `@retention/shared`**: rejected. That package is scoped to the retention backoffice (thresholds, routing schemas, constants). Mixing in send-service utilities would blur its purpose.
