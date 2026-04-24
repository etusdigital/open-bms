# UA denylist for bot detection (extension to MMDB classifier)

**Date:** 2026-04-20
**Author:** Filipe Bragança
**Branch:** `feat/event-process-is-bot-flag` (same PR as MMDB refactor — #33)
**Depends on:** [2026-04-20-bot-detection-mmdb-refactor.md](./2026-04-20-bot-detection-mmdb-refactor.md)

---

## Motivation

The MMDB-based `BotDetector` lands three signal tiers:

- **`is_bot`** (narrow) — user_type=hosting AND ASN ∈ known mail-scanner list.
- **`is_datacenter`** (wide) — user_type=hosting.
- Per-event metadata (`asn`, `asn_org`, `user_type`, `bot_classification`).

That catches Gmail/Outlook/Yahoo pre-fetchers (narrow) plus Shop app / other GCP-hosted SaaS (wide). The gap is **scripted clients that announce themselves in the User-Agent**: `Shop Service` is the canonical example, but also `curl`, `wget`, `HeadlessChrome`, `Googlebot`, etc. Today those clients land in `is_datacenter=true, is_bot=false` when they come from hosting IPs — which is accurate but under-classified: a `Shop Service` click is _clearly_ automated, not a grey zone.

This extension adds a **UA denylist** that promotes `is_datacenter=true` clicks with scripted UAs to `is_bot=true`. Operationally, the feedback loop is: watch `events_logs_v2` for `is_datacenter=true AND is_bot=false`, find UA patterns that are clearly non-human, add them to the denylist via a code change + PR.

## Design decision: UA signal is gated by `is_datacenter`

Two design options were considered:

- **Option X — UA as standalone OR condition.** `is_bot = (mail-scanner-ASN && hosting) OR ua-in-denylist`. Catches scripted UAs from residential IPs too.
- **Option Y — UA upgrades `is_datacenter=true` hits to `is_bot=true`.** `is_bot = is_datacenter && (mail-scanner-ASN || ua-in-denylist)`. **Chosen.**

Rationale for Y:

1. **Preserves `bot ⊆ datacenter` invariant.** The aggregator spec already asserts `bot_click ≤ datacenter_click`. Option X would break this whenever a curl-from-residential click arrived.
2. **Matches the operational loop the user described.** "Find datacenter records that should be flagged as bot, update the denylist" — explicitly a promotion operation.
3. **Near-zero detection loss.** Residential-proxy bots (Bright Data, Oxylabs) deliberately spoof real browser UAs — they'd never match a script-UA denylist. Legitimate scripting from residential IPs to email links is exceptionally rare and not worth gaming the schema for.

## The denylist

A small, hand-curated set of case-sensitive substring patterns, one per known non-human client. Matches → promote to `is_bot=true` **when `is_datacenter` is already true**.

Grouped by category (all substrings, case-sensitive unless noted):

### Mail-app scanners / preview fetchers

- `Shop Service` — Shopify Shop app
- `shop.app`
- `Microsoft Office` — Outlook safe-link preview (supplements the AS8075 signal for UA-only hits)
- `Mailchimp` — Mailchimp link preview
- `Mandrill`
- `YahooMailProxy`

### Scripting / HTTP clients

- `curl/` — curl default UA
- `Wget/` — wget default UA (note capital W)
- `python-requests/`
- `python-urllib`
- `aiohttp/`
- `httpx/`
- `Go-http-client/`
- `Java/` — Apache HttpClient default (`Java/17.0.1` etc)
- `okhttp/`
- `node-fetch`
- `axios/`
- `got (https://github.com/sindresorhus/got)`
- `libwww-perl/`
- `PostmanRuntime/`

### Headless / automation

- `HeadlessChrome`
- `PhantomJS`
- `Selenium`
- `Playwright`
- `Puppeteer`

### Search engine crawlers

- `Googlebot`
- `AdsBot-Google`
- `Bingbot`
- `Slurp` — Yahoo crawler
- `DuckDuckBot`
- `Baiduspider`
- `YandexBot`
- `Applebot`

### Social crawlers

- `facebookexternalhit`
- `Twitterbot`
- `LinkedInBot`
- `WhatsApp` — WhatsApp link preview (careful: WhatsApp mobile _app_ UA contains `WhatsApp/X.Y.Z iPhone` — but also the `WhatsApp` link preview contains the same substring. Acceptable to flag both since we don't currently distinguish WhatsApp in-app browser traffic anyway)

### Generic bot markers (case-insensitive — see implementation note)

- `bot` as a standalone word (regex `\bbot\b`, case-insensitive) — catches `SomeNewBot/1.0` without false-positiving `Cubot` (phone) or `robot` (rare).

### Explicitly NOT in the denylist (open questions parked)

- Empty UA — some legit clients send empty UA; unclear signal without data.
- Generic `Mozilla/5.0 (compatible; ...)` — too broad, catches real browsers.
- In-app mobile browsers (`FBAN/`, `FBAV/`, `Instagram`, `GSA/`, `Bytedance`) — these are **humans** using apps. Deliberately excluded.
- Apple Mail's `Mail/` or `iPhone Mail` — humans reading email, not scanners.

## Implementation

### Module

Extend `apps/event-process/src/utils/bot-detector.ts`:

```ts
// Case-sensitive substring patterns for scripted / automated clients.
// Expanded via PR as new patterns surface in production data.
// Keep each entry commented with its source — reviewers need to know WHY
// a UA substring is in the denylist before approving additions.
const SCRIPT_UA_SUBSTRINGS: readonly string[] = [
  'Shop Service',
  'shop.app', // Shopify Shop
  'Microsoft Office', // Outlook preview
  'Mailchimp',
  'Mandrill',
  'YahooMailProxy', // mail-app scanners
  'curl/',
  'Wget/', // generic scripts
  'python-requests/',
  'python-urllib',
  'aiohttp/',
  'httpx/',
  'Go-http-client/',
  'Java/',
  'okhttp/',
  'node-fetch',
  'axios/',
  'got (https://github.com/sindresorhus/got)',
  'libwww-perl/',
  'PostmanRuntime/',
  'HeadlessChrome',
  'PhantomJS',
  'Selenium',
  'Playwright',
  'Puppeteer',
  'Googlebot',
  'AdsBot-Google',
  'Bingbot',
  'Slurp',
  'DuckDuckBot',
  'Baiduspider',
  'YandexBot',
  'Applebot',
  'facebookexternalhit',
  'Twitterbot',
  'LinkedInBot',
  'WhatsApp',
];

// Generic bot-name marker. Word-boundary regex avoids false positives on
// "Cubot" (phone model), "robot" (narrative text), etc.
const BOT_WORD = /\bbot\b/i;

export function isScriptUserAgent(ua: string | undefined | null): boolean {
  if (!ua) return false;
  for (const needle of SCRIPT_UA_SUBSTRINGS) {
    if (ua.includes(needle)) return true;
  }
  return BOT_WORD.test(ua);
}
```

### Classifier change

`BotDetector.classify` grows a second parameter:

```ts
static classify(traits: Traits | undefined | null, userAgent?: string | null): BotSignals {
  // ...existing asn / user_type / is_datacenter extraction...

  const scannerMatch = MAIL_SCANNER_ASNS[asn];
  const uaScriptMatch = is_datacenter && isScriptUserAgent(userAgent);

  const is_bot = is_datacenter && (scannerMatch !== undefined || uaScriptMatch);

  const classification: BotClassification =
    scannerMatch !== undefined ? scannerMatch :
    uaScriptMatch ? 'script_ua' :
    is_datacenter ? 'datacenter' :
    null;

  return { is_bot, is_datacenter, classification, asn, asn_org, user_type };
}
```

New `BotClassification` literal: `'script_ua'`.

### Call-site wiring

Two points in `apps/event-process/src/events/services/events.service.ts`:

1. **`processMessageToKafka`** — pass `message.userAgent` (or `message.user_agent`) alongside `message.traits`:

   ```ts
   const signals = BotDetector.classify(message.traits, message.userAgent ?? message.user_agent);
   ```

2. **`updateEventStatistics`** (click counter) — pass `options.userAgent`:

   ```ts
   if (options.event === 'click') {
     const signals = BotDetector.classify(options.geoData?.traits, options.userAgent);
     // ...
   }
   ```

No new options threading required — both callsites already have userAgent in scope.

### Tests

Extend `bot-detector.spec.ts`:

- Shop Service UA + GCP hosting traits → `is_bot=true`, `is_datacenter=true`, `classification='script_ua'`.
- `curl/8.4.0` UA + AWS hosting traits → `is_bot=true`, `classification='script_ua'`.
- `Googlebot` UA + hosting → `is_bot=true`, `classification='script_ua'`.
- Denylist UA + residential traits → `is_bot=false, is_datacenter=false` (Option Y: UA alone doesn't flip is_bot).
- Real mobile in-app UA (`FBAN/FBAV/`, `GSA/`, `Instagram`) + residential traits → clean, not flagged.
- Real Chrome UA + Gmail hosting (AS15169) → still `classification='gmail_prefetch'` (ASN wins over UA when both match).
- `Cubot` phone UA (contains substring `bot` but not word-boundary) → NOT flagged.
- Empty string UA / undefined UA → not flagged.
- `\bbot\b` catches `SomeNewBot/1.0` with case-insensitive word boundary.

Extend `events.service.spec.ts`:

- UpdateEventStatistics: `Shop Service` UA on a GCP click → `bot_click` AND `datacenter_click` both increment.
- UpdateEventStatistics: `curl` UA on a residential click → neither counter increments.
- SendKafkaMessage: Kafka stamping reflects UA-promoted is_bot correctly for Shop app message.

### Aggregator

No change. `bot_click` definition widens by extension but the column, the Redis key, and the INSERT column list stay identical. `bot_click ≤ datacenter_click` invariant preserved.

### Commit shape

Two commits on the existing branch:

1. `docs(event-process): plan UA denylist extension to bot detection`
2. `feat(event-process): promote datacenter clicks with script UAs to is_bot`

Added on top of the existing 4-commit MMDB history, so PR #33 grows to 6 commits.

## Operational process: adding to the denylist

When new patterns surface in dashboards (queries like "top 20 UAs for `is_datacenter=true AND is_bot=false` clicks last 7 days"):

1. Identify the pattern. Confirm it's clearly automated (high click volume + pattern in UA string + IP in hosting space).
2. Add a new entry to `SCRIPT_UA_SUBSTRINGS` with a one-line comment explaining the source.
3. Add a test case in `bot-detector.spec.ts` covering the new pattern.
4. PR. Reviewer checks: is this really non-human? Any chance of false-positive on a real in-app browser?
5. Merge → next release picks up the broadened denylist automatically.

No config file, no monthly cron, no CI refresh — the denylist lives in code, version-controlled, reviewed per change.

## Out of scope for this change

- UA-based classification as a standalone signal from residential IPs (Option X). Rejected per invariant argument above.
- Empty-UA detection. Parked pending data.
- Distinguishing mail-scanner UAs (Shop Service, Microsoft Office preview) from generic scripting (`curl`) — both become `classification='script_ua'` for v1. If reporting needs to split, we can introduce `shop_app` / `mail_scanner_ua` classifications in a follow-up — the data to do so is already in `events_logs_v2.user_agent`.
- ASN allowlist for iCloud Private Relay / SSE gateways (still parked from the parent plan).
