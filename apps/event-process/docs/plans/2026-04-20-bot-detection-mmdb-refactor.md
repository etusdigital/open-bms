# Bot detection: refactor to MMDB traits

**Date:** 2026-04-20
**Author:** Filipe Bragança
**Branch:** `feat/event-process-is-bot-flag`
**PR:** [#33](https://github.com/Etus/etus-monorepo/pull/33) (open, unmerged)
**Supersedes:** the CIDR-list approach of commits `7fe9cc47..44865ef3f` on this branch

---

## Motivation

The current PR ships bot detection via a hand-curated CIDR JSON (`src/config/bot-ip-ranges.json`) refreshed monthly by a CI workflow + bash script. While the approach works for the narrow list of Gmail / Outlook / Yahoo pre-fetchers we seeded, it has three structural problems:

1. **It doesn't scale.** Every time we discover a new hosted source of non-human traffic (Shop app, GCP-hosted third parties, future mail-scanner vendors), we need a new CIDR commit. Cloud providers publish thousands of prefixes that rotate continuously.
2. **It duplicates a source of truth we already pay for.** We license the DB-IP Full MMDB (`~/Projects/Etus/dbip-full-2026-04.mmdb`) and already refresh it monthly for geolocation. That MMDB carries `traits.autonomous_system_number`, `traits.autonomous_system_organization`, `traits.user_type`, `traits.connection_type`, and `traits.is_anycast` — a richer, authoritative classification for every IP on the internet.
3. **Three of our current Yahoo CIDRs are demonstrably stale** in DB-IP's April 2026 data (`180.60.0.0/16` is now NTT Communications residential/business, `66.196.0.0/16` is fragmented across Grande Communications and others). The manual list would drift without us noticing until a customer complains.

This plan replaces the CIDR-based classification with MMDB `traits` lookups, deletes the refresh script and CI workflow, and expands the single `is_bot` boolean into a richer tagging scheme that reflects the honest limits of what IP data can tell us — especially for opens.

## Design decisions (locked)

All six decisions confirmed in conversation, 2026-04-20:

1. **Proto shape:** extend existing `LocationResponse` with an optional `traits` sub-message. Single gRPC round-trip. Additive, no break for existing callers.
2. **Metric separation:** keep `bot_*` and `datacenter_*` as distinct counters. `bot_*` means narrow (known mail-scanner ASNs + `user_type=hosting`). `datacenter_*` means wide (`user_type=hosting` anywhere, excluding a future allowlist). Both events also stamp a freeform `classification` string for human/query context.
3. **Private Relay / SSE carve-outs:** **none in v1.** If post-deploy dashboards show over-flagging of real users (iCloud Private Relay, enterprise SSE gateways), we'll add a small ASN allowlist in a follow-up. Easier to add on evidence than to pre-emptively maintain.
4. **`user_type=cdn`:** **excluded** from `is_datacenter`. CDN traffic often fronts legitimate human clicks via shortener redirects. `is_datacenter` is hosting-only.
5. **Plan location:** this file, committed to the branch.
6. **Opens vs clicks — the honest-metric decision:**
   - **Clicks**: full split — `is_bot`, `is_datacenter`, `bot_click`, `datacenter_click` columns, Redis counters.
   - **Opens**: events get the same per-event metadata stamped (`is_bot`, `is_datacenter`, `classification`, `asn`, `asn_org`, `user_type`) for forensics and ad-hoc queries, but **no aggregate columns, no Redis counters, no filtered open rate**.
   - Rationale: Gmail / Apple Mail-with-MPP / Outlook webmail proxy _every_ image fetch, including when the real user actually reads the email hours later. IP-level signal cannot distinguish "prefetch" from "real read" for the majority of recipients. An aggregate `bot_open` count would imply the complement is "human opens," which isn't true — it would invite incorrect dashboards. Open rate stays `opens_total / delivered` as today.

## Non-goals

- Residential-proxy detection (Bright Data, Oxylabs). Not solvable with IP data alone.
- Velocity/burst detection for opens. Interesting future work; needs real-data calibration.
- Temporal-signal weighting (time-since-send). Same.
- UA-based bot detection. Complementary but out of scope — already covered partially by `UAParser` elsewhere.
- Engagement-score blending clicks + conversions. Product-level metric redesign, not an event-ingestion concern.

## Architecture overview

```
+--------------------+           gRPC            +------------------------+
| event-process      | --- GetLocation(ip) --->  | geolocation service    |
| (events.service.ts)|                           | (apps/geolocation)     |
|                    | <--- LocationResponse --- |                        |
|                    |       { ...geo,           |  MMDB lookup           |
|                    |         traits: {...} }   |  (DB-IP Full)          |
|  BotDetector       |                           +------------------------+
|  .classify(traits) |
|  -> signals        |
|                    |
|  stamp Kafka msg   |
|  increment Redis   |  (clicks only)
+--------------------+
          |
          v
+------------------------+
|  msgops-api aggregator |
|  Redis -> Postgres     |
|  events_statistics:    |
|    bot_click           |
|    datacenter_click    |
+------------------------+
```

Key shift: bot classification becomes **stateless and data-driven**. `BotDetector` is a pure function over traits. No file I/O, no config loading, no zod schema, no CIDR matching. The only "config" is two code constants: `MAIL_SCANNER_ASNS` and (in a future iteration) `PRIVATE_RELAY_ASN_ALLOWLIST`.

---

## Phase 1 — Extend geolocation service with traits

**Scope:** `apps/geolocation/**` + `apps/event-process/src/utils/geolocation/**`.

### Proto change

`apps/geolocation/src/geoip.proto` and its mirror `apps/event-process/src/utils/geolocation/geoip.proto`:

```proto
message Traits {
  uint32 asn = 1;
  string asn_org = 2;
  string isp = 3;
  string organization = 4;
  string user_type = 5;        // "hosting" | "business" | "residential" | "cellular" | "cdn" | "college" | "government" | "dialup" | ""
  string connection_type = 6;  // "Corporate" | "Cellular" | "Cable/DSL" | "Dialup" | ""
  bool is_anycast = 7;
}

message LocationResponse {
  string country = 1;
  string region = 2;
  string city = 3;
  string postalCode = 4;
  string timezone = 5;
  double latitude = 6;
  double longitude = 7;
  bool success = 8;
  string error = 9;
  Traits traits = 10;          // NEW — optional, absent for IPs with no match
}
```

### Service change

`apps/geolocation/src/app.service.ts`:

- Extend `GeoIpLookupResult` type (in `geoip.interface.ts`) to include `traits`.
- After the existing geo field extraction in `getLocation()`, build the `traits` object from `response.traits`:
  ```ts
  traits: response?.traits ? {
    asn: response.traits.autonomous_system_number ?? 0,
    asn_org: response.traits.autonomous_system_organization ?? '',
    isp: response.traits.isp ?? '',
    organization: response.traits.organization ?? '',
    user_type: response.traits.user_type ?? '',
    connection_type: response.traits.connection_type ?? '',
    is_anycast: response.traits.is_anycast ?? false,
  } : undefined,
  ```
- Graceful default when MMDB returns no traits (private/reserved IPs, invalid IPs).

### Client-side interface

`apps/event-process/src/utils/geolocation/geolocation.interface.ts`:

- Add `Traits` interface matching the proto.
- Add optional `traits?: Traits` to `LocationResponse`.

### Tests

`apps/geolocation/src/app.service.spec.ts` — add cases covering:

- Gmail IP (74.125.1.1): traits present, `user_type='hosting'`, `asn=15169`, `asn_org='Google LLC'`.
- Outlook IP (40.107.1.1): `asn=8075`, `asn_org='Microsoft Corporation'`.
- Yahoo-valid IP (98.136.0.1): `asn=7233`, `user_type='hosting'`.
- GCP IP (34.138.1.1): `asn=396982`, `user_type='hosting'`.
- Private IP (10.0.0.1): `traits` absent, `success=false` (existing behavior preserved).
- Invalid IP: `success=false` (existing behavior preserved).

### Review checkpoint

**Stop after Phase 1 commits.** Human review confirms proto shape + backwards compatibility before we couple event-process to it.

---

## Phase 2 — Replace IpRangeChecker with BotDetector

**Scope:** `apps/event-process/src/utils/**`.

### Files

- **Add** `apps/event-process/src/utils/bot-detector.ts`.
- **Add** `apps/event-process/src/utils/bot-detector.spec.ts`.
- **Delete** `apps/event-process/src/utils/ip-range-checker.ts`.
- **Delete** `apps/event-process/src/utils/ip-range-checker.spec.ts`.
- **Delete** `apps/event-process/src/config/bot-ip-ranges.json`.

### Interface

```ts
export type UserType = 'hosting' | 'business' | 'residential' | 'cellular' | 'cdn' | 'college' | 'government' | 'dialup' | '';

export interface Traits {
  asn: number;
  asn_org: string;
  user_type: UserType | string;
  // Other fields available but not part of the detection primitive:
  // isp, organization, connection_type, is_anycast
}

export interface BotSignals {
  is_bot: boolean; // narrow: known mail-scanner ASN + user_type=hosting
  is_datacenter: boolean; // wide: any user_type=hosting
  classification: BotClassification | null;
  asn: number;
  asn_org: string;
  user_type: string;
}

export type BotClassification = 'gmail_prefetch' | 'outlook_prefetch' | 'yahoo_prefetch' | 'datacenter' | null;

const MAIL_SCANNER_ASNS: Record<number, BotClassification> = {
  15169: 'gmail_prefetch', // Google (Gmail Image Proxy, link pre-fetcher)
  8075: 'outlook_prefetch', // Microsoft Exchange Online / Safe Links
  7233: 'yahoo_prefetch', // Yahoo / Oath
  36646: 'yahoo_prefetch',
  36647: 'yahoo_prefetch',
  10310: 'yahoo_prefetch', // Oath Holdings
};

export class BotDetector {
  static classify(traits: Traits | undefined): BotSignals {
    const asn = traits?.asn ?? 0;
    const asn_org = traits?.asn_org ?? '';
    const user_type = traits?.user_type ?? '';

    const is_datacenter = user_type === 'hosting';
    const scannerClassification = MAIL_SCANNER_ASNS[asn];
    const is_bot = is_datacenter && scannerClassification !== undefined;

    const classification: BotClassification = is_bot ? scannerClassification : is_datacenter ? 'datacenter' : null;

    return { is_bot, is_datacenter, classification, asn, asn_org, user_type };
  }
}
```

### Package cleanup

- Remove `ipaddr.js` from `apps/event-process/package.json` dependencies (verified no other file imports it).
- Keep `zod` (used by other modules).

### Tests

Cover every row with real sample IPs from our investigation:

| Category                      | Sample IP           | Expected `is_bot` | Expected `is_datacenter` | Expected `classification`              |
| ----------------------------- | ------------------- | ----------------- | ------------------------ | -------------------------------------- |
| Gmail pre-fetcher             | 74.125.1.1          | true              | true                     | `gmail_prefetch`                       |
| Gmail summary block           | 209.85.128.1        | true              | true                     | `gmail_prefetch`                       |
| Outlook scanner               | 40.107.1.1          | true              | true                     | `outlook_prefetch`                     |
| Yahoo valid                   | 98.136.0.1          | true              | true                     | `yahoo_prefetch`                       |
| GCP Shop app                  | 35.227.11.224       | false             | true                     | `datacenter`                           |
| GCP generic                   | 34.138.1.1          | false             | true                     | `datacenter`                           |
| Cloudflare                    | 1.1.1.1             | false             | true                     | `datacenter` (until allowlisted in v2) |
| Residential (US)              | (pick from CH data) | false             | false                    | `null`                                 |
| Cellular                      | (pick from CH data) | false             | false                    | `null`                                 |
| Empty traits (undefined)      | —                   | false             | false                    | `null`                                 |
| Traits with unknown user_type | —                   | false             | false                    | `null`                                 |

Tests call `BotDetector.classify` directly with synthetic traits objects — no MMDB dependency, no network, no fixtures. Pure unit.

---

## Phase 3 — Wire BotDetector into events.service

**Scope:** `apps/event-process/src/events/services/events.service.ts` + spec.

### Changes

1. **Remove** `IpRangeChecker` import (line 13), static field (line 22), init (line 46).
2. **Remove** the whole `classification` block at line 493-498 and the property stamping at 521-525.
3. **Extend `getGeoIpInfo(ip)`** to also return traits:
   ```ts
   protected async getGeoIpInfo(ip: string): Promise<{
     country?: string;
     region?: string;
     city?: string;
     traits?: Traits;
   }> {
     if (!ip) return {};
     try {
       const location = await this.geolocationService.getLocation(ip);
       return {
         country: location.country,
         region: location.region,
         city: location.city,
         traits: location.traits,
       };
     } catch (error) {
       this.formatterUtils.logInfo(`Error getting GeoIP info for ${ip}: ${error}`);
       return {};
     }
   }
   ```
4. **In `processMessageToKafka`** (and wherever message enrichment happens — need to audit all stamp sites during implementation):

   ```ts
   const signals = BotDetector.classify(message.traits);
   return {
     ...message,
     // ...existing fields...
     properties: {
       ...(message.properties ?? {}),
       is_bot: signals.is_bot,
       is_datacenter: signals.is_datacenter,
       bot_classification: signals.classification,
       asn: signals.asn,
       asn_org: signals.asn_org,
       user_type: signals.user_type,
     },
   };
   ```

   — for both click AND open events. Same shape, same code path.

5. **Redis counter logic (to audit during implementation):** the commits that introduced `bot_open` / `bot_click` counters are on this branch. In Phase 3:
   - Keep `bot_click` counter increment (when `is_bot && eventType === 'click'`).
   - Add `datacenter_click` counter increment (when `is_datacenter && eventType === 'click'`).
   - **Remove** `bot_open` counter increment entirely — per decision 6, opens don't get aggregate counters.

### Tests

- Update `events.service.spec.ts` to verify the six new stamped fields on a mock click event and a mock open event.
- Verify Redis counter pipeline increments `bot_click` + `datacenter_click` on bot/DC clicks.
- Verify **no** `bot_open` or `datacenter_open` counter increments regardless of open event traits.
- Verify a residential click does not increment either counter.

---

## Phase 4 — Storage: reshape migration + aggregator

**Scope:** `apps/msgops-api/**` + `@retention/database` (if shared entities are used).

### Migration

Edit `apps/msgops-api/src/migrations/1776703279057-alter-events-statistics-add-bot-counters.ts` in place (it has not shipped — still on this branch only):

- **Rename** the file and class to `1776703279057-alter-events-statistics-add-bot-datacenter-click-counters.ts` / `alterEventsStatisticsAddBotDatacenterClickCounters1776703279057`.
- **Columns:**
  - `bot_click` (integer, default 0, not null) — keep.
  - `datacenter_click` (integer, default 0, not null) — **new**.
  - `bot_open` — **remove from this migration entirely.** Never lands in production.
- Update `down()` accordingly.

### Entity

If an `EventStatisticsEntity` has explicit column declarations for `bot_open` / `bot_click`, mirror the migration:

- Remove `bot_open` property.
- Keep `bot_click`.
- Add `datacenter_click`.

### Aggregator

`apps/msgops-api/src/modules/statistics/statistics.aggregation.ts`:

- **Remove** all reads and writes of `bot_open` (currently at lines 368 and 434, and in the INSERT column list at line 389).
- **Add** reads + writes of `datacenter_click` next to `bot_click`.
- The INSERT column count moves from 37 to 37 (remove `bot_open`, add `datacenter_click` — net zero); verify `valuesIndex` offset logic still aligns. If the count changes, update the `offset = index * N` calculation.

### Interface

`apps/msgops-api/src/modules/statistics/statistics.interface.ts`:

- Update `RedisStatistics` and `AggregatedData` to drop `bot_open`, add `datacenter_click`.

### Tests

`apps/msgops-api/src/modules/statistics/statistics.aggregation.spec.ts`:

- Drop `bot_open` assertions.
- Add `datacenter_click` assertions matching `bot_click` structure.

---

## Phase 5 — Delete CIDR artifacts

**Scope:** filesystem.

- `rm apps/event-process/src/config/bot-ip-ranges.json` (if not already deleted in Phase 2).
- `rm apps/event-process/scripts/update-bot-ip-ranges.sh`.
- `rm -r apps/event-process/scripts/` if it becomes empty.
- `rm .github/workflows/refresh-bot-ip-ranges.yml`.
- Remove `ipaddr.js` from `apps/event-process/package.json` (if not already done in Phase 2).
- Run `pnpm install` from repo root to update lockfile.

---

## Phase 6 — Branch history + PR body

**Scope:** git.

The current branch has 7 commits, of which the last 2 (refresh script + CI workflow) and parts of the first 5 (CIDR JSON, IpRangeChecker, zod config schema, the `bot_classification: provider` Kafka field) will be superseded. Two options:

**(a) Force-push clean history** (recommended).
Rewrite the branch so the commit log tells the final story:

- `feat(event-process): extend geolocation service with ASN/user_type traits`
- `feat(event-process): add BotDetector (MMDB-driven classification)`
- `feat(event-process): stamp is_bot/is_datacenter on clicks and opens`
- `feat(msgops-api): add bot_click + datacenter_click columns`
- `chore(event-process): remove stale CIDR-based bot detection`
- `docs(event-process): document bot detection refactor plan`

Safe because PR #33 has no external review comments tied to specific lines yet.

**(b) Additive commits on top.**
Cleaner audit trail but reviewers must reason about two systems. Rejected.

### PR body rewrite

Replace PR #33's description to:

- Explain the MMDB-based approach.
- Link this plan doc.
- Document the opens-vs-clicks asymmetry so reviewers don't ask "why no `datacenter_open`?"
- Flag the retention-team comms heads-up (see below).

---

## Pre-deploy comms (not code, but plan-artifact)

**Audience:** retention team, data/analytics team, anyone who consumes the ClickHouse `events_logs_v2` dataset or the Postgres `events_statistics` table.

**Message to send ≥2 business days before merge:**

> Heads-up: we're shipping IP-based bot classification for email events.
>
> **Clicks** get two new columns — `bot_click` (known mail-scanner ASNs: Google 15169, Microsoft 8075, Yahoo 7233/36646/36647/10310 in datacenter space) and `datacenter_click` (any IP in hosting space — catches the ~15% of clicks that come from Shop app, Outlook Safe Links, GCP-hosted services, etc.). Use these to compute cleaner click-through rates.
>
> **Opens** do **not** get aggregate columns. Instead, every open event now carries per-event metadata (`properties.is_bot`, `properties.is_datacenter`, `properties.bot_classification`, `properties.asn`, `properties.asn_org`, `properties.user_type`) that you can filter in ad-hoc queries.
>
> **Why opens are different:** Gmail / Apple Mail-with-MPP / Outlook webmail proxy every image fetch through their infrastructure — including when the real user actually reads the email, hours later. We cannot distinguish "prefetch" from "real read" at the IP level. Any aggregate `bot_open` metric would imply the complement is "human opens," which would be misleading. Open rate stays as-is; click rate becomes the honest engagement metric.
>
> Dashboards: open rate visibly unchanged, click rate may de-noise slightly downward. No P1 expected.

## Future work (parked, not v1)

- **ASN allowlist for `is_datacenter`.** Carve out iCloud Private Relay (AS13335 Cloudflare egress, AS16509/14618 AWS Apple egress), major SSE gateways (Zscaler, Netskope). Add when we see evidence of real-user over-flagging in dashboards.
- **Velocity/burst detection for opens.** ≥ N opens from same account + same ASN within a second → probable proxy sweep. Needs calibration against a week of real data.
- **Mail-client fingerprinting.** UA + image-load-rate patterns to infer "proxy-using client" vs "direct client." Fuzzy.
- **Engagement score.** Product-level metric blending clicks + conversions + replies + unsubscribes, reducing reliance on opens entirely.

## Testing strategy

- **Unit:** `BotDetector.classify` with synthetic traits (Phase 2); pure function, no I/O.
- **Unit:** `AppService.getLocation` with a small fixture MMDB (or real MMDB on CI if available) — Phase 1.
- **Unit:** `EventsService.processMessageToKafka` and its counterparts with mocked geolocation client returning traits — Phase 3.
- **Unit:** aggregator columns in `statistics.aggregation.spec.ts` — Phase 4.
- **Integration:** end-to-end smoke test would require the geolocation service running against the real MMDB. Out of scope for this PR; to be validated in staging before the retention-team comms go out.

## Appendix — verified IPs from DB-IP Full (April 2026)

Verified 2026-04-20 against `~/Projects/Etus/dbip-full-2026-04.mmdb`:

| Range (current config)    | Sampled IP    | ASN      | Org                       | user_type    | Notes                      |
| ------------------------- | ------------- | -------- | ------------------------- | ------------ | -------------------------- |
| 74.125.0.0/16             | 74.125.1.1    | 15169    | Google LLC                | hosting      | Gmail pre-fetcher ✓        |
| 172.253.0.0/16            | 172.253.1.1   | 15169    | Google LLC                | hosting      | ✓                          |
| 173.194.0.0/16            | 173.194.1.1   | 15169    | Google LLC                | hosting      | ✓                          |
| 209.85.128.0/17           | 209.85.128.1  | 15169    | Google LLC                | hosting      | ✓                          |
| 64.233.160.0/19           | 64.233.160.1  | 15169    | Google LLC                | hosting      | ✓                          |
| 66.102.0.0/20             | 66.102.0.1    | 15169    | Google LLC                | hosting      | ✓                          |
| 66.249.64.0/19            | 66.249.64.1   | 15169    | Google LLC                | hosting      | ✓                          |
| 40.92.0.0/15              | 40.92.1.1     | 8075     | Microsoft                 | hosting      | ✓                          |
| 40.107.0.0/16             | 40.107.1.1    | 8075     | Microsoft                 | hosting      | ✓                          |
| 52.100.0.0/14             | 52.100.1.1    | 8075     | Microsoft                 | hosting      | ✓                          |
| 104.47.0.0/17             | 104.47.1.1    | 8075     | Microsoft                 | hosting      | ✓                          |
| 98.136.0.0/14             | 98.136.0.1    | 7233     | Yahoo                     | hosting      | ✓                          |
| **180.60.0.0/16**         | 180.60.0.1    | **4713** | **NTT Communications**    | **business** | ⚠️ STALE — not Yahoo       |
| **66.196.0.0/16**         | 66.196.0.1    | **7459** | **Grande Communications** | **business** | ⚠️ STALE — fragmented      |
| 34.x (Shop app)           | 34.138.1.1    | 396982   | Google LLC (GCP)          | hosting      | Caught via `is_datacenter` |
| 35.x (Shop app)           | 35.227.11.224 | 396982   | Google LLC (GCP)          | hosting      | Caught via `is_datacenter` |
| 23.227.63.0/24 (Shop app) | 23.227.63.4   | 396982   | Google LLC (GCP)          | hosting      | Caught via `is_datacenter` |

The two stale entries are the smoking gun for switching approaches: they'd quietly over-flag real residential/business users for as long as nobody notices. MMDB traits would have caught them by refusing to classify those IPs as hosting.
