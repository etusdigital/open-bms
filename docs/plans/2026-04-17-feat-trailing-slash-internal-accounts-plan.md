---
title: Trailing Slash On Outbound URLs For Internal Accounts
type: feat
status: active
date: 2026-04-17
origin: docs/plans/2026-04-17-feat-trailing-slash-internal-accounts-design.md
---

# Trailing Slash On Outbound URLs For Internal Accounts

## Overview

Add a canonical trailing slash to the path portion of URLs emitted by the four send services (`send-email`, `send-push`, `send-whatsapp`, `twilio-messaging`) — but only when the sending account is marked `isInternal`. A new workspace package `@msgops/url-utils` holds a single pure helper; each service gates the call on `account.isInternal`.

## Problem Statement

URLs sent to end users (e.g., `example.com/lp?utm_source=x`) lack a trailing slash on the path. Analytics and SEO treat `example.com/lp` and `example.com/lp/` as distinct URLs, fragmenting reports and weakening canonicalisation for Etus's own landing pages. External customer URLs must not be modified — their canonical form is their decision.

See the origin design doc for full decision history, alternatives considered, and edge-case reasoning: [`docs/plans/2026-04-17-feat-trailing-slash-internal-accounts-design.md`](2026-04-17-feat-trailing-slash-internal-accounts-design.md).

## Proposed Solution

1. New workspace package `packages/url-utils/` (published as `@msgops/url-utils`) exposing `addTrailingSlash(url: string): string`.
2. Publishers (`msgops-api`, `message-trigger`) include `account.isInternal` on the Account object embedded in Pub/Sub payloads.
3. Each of the four consumer services extends its local `Account` interface with `isInternal?: boolean` (temporarily optional during rollout — see Phase 5) and gates a call to `addTrailingSlash()` at its single URL-finalisation point.

## Technical Considerations

- **Package home.** The utility lives in a new workspace package `@msgops/url-utils` rather than being folded into `@retention/shared`. Reasoning: `@retention/shared` is scoped to retention-backoffice concerns (thresholds, routing rules, constants consumed by `backoffice-api` and `backoffice-frontend`). The send-service messaging pipeline is a distinct domain — mixing the two would blur package boundaries and grow `@retention/shared` past its charter. A new focused package is cheap (mirrors the `packages/shared/` layout; no new build tooling) and keeps the codebase navigable as the msgops side grows.
- **Pure function, gated at call site.** Policy lives in callers — see the "Alternatives considered" section of the design doc and note below on reconsideration post-review.
- **Template-safe.** The function short-circuits on path-segment templates (`{{...}}`) but allows query-param templates (the common case). It does **not** round-trip through `new URL()` for reconstruction — string-based reassembly preserves any encoding already in the input.
- **File-extension detection is regex-based.** `\.[A-Za-z0-9]{1,8}$` on the path portion. Catches `.pdf`, `.jpg`, `.xml`, `.gz`; correctly lets `/v1.2/users` through; does not depend on the presence of `/`.
- **WhatsApp / Twilio API change.** `createRedictLink(...)` is renamed to `createRedirectLink(...)` (typo fix) and switched to an options-object signature so that future additions are non-breaking. `account` becomes a required field.
- **Send-email override block.** `mail.utils.ts` contains a hardcoded A/B test override for account 16 / message 555704 (lines 447–454). The slash call must happen **after** the override so whichever URL wins is canonicalised.
- **In-flight backwards compatibility.** Marking `isInternal?` optional during rollout keeps pre-upgrade publisher messages safe. **Phase 5 tightens it to required** once all publishers have been verified — the field is not designed to be permanently optional.
- **Post-review gating decision.** Reviewers re-challenged the design doc's "pure function + caller-gated" choice, noting that the package is private/workspace-only so the "keep the utility general" argument is weaker than the brainstorm implied. We are keeping the original decision (one-line ternary in 4 call sites) because (a) the user explicitly chose it during brainstorming, (b) the risk of a 5th send service missing the gate is mitigated by code review, and (c) a wrapper `canonicalizeForAccount(url, account)` can be added later non-disruptively if the risk materialises. This is now documented in the "Alternatives considered" section of the design doc.

## System-Wide Impact

- **Interaction graph.** Publisher → Pub/Sub topic → consumer (send-\*). No callbacks, middleware, or observers fire based on URL content. The change is localised to payload construction and URL string manipulation.
- **Error propagation.** `addTrailingSlash()` is total (no throws) — on any unhandled edge case it returns the input unchanged. A bug in the utility degrades gracefully to today's behaviour.
- **State lifecycle risks.** None — this is a pure transformation of outbound data with no persistence effect.
- **Analytics split during rollout.** Internal-account click events in ClickHouse `events_logs_v2` and any UTM-keyed analytics will show both old-form and new-form URLs for the rollout window. Any dashboard that groups by exact destination URL should be aware of the transition. **Action:** flag this to retention analytics before Phase 3 deploys; confirm whether landing pages serve 301s from slash-less form to slash-ful form (they should, for SEO canonicalisation — this also mitigates the split).
- **bmsclick redirect wrapper is unmodified.** The `bmsclick.${domain}/redirect?url=...` outer URL is left alone; only the destination URL encoded inside the `url=` param is canonicalised. This means bmsclick click-tracking continues to attribute to the campaign/message correctly; the slash is applied to the decoded destination.
- **Unsubscribe routes.** The design doc flagged this as a risk. `createEmailPixel` processes all `<a>` hrefs in the user's HTML, which may include unsubscribe links. `msgops-api` unsubscribe endpoints should be verified to accept both `/unsub/xyz` and `/unsub/xyz/` variants before Phase 3 deploys to production. If they do not, add a path-prefix skip for unsubscribe URLs at the call site.
- **API surface parity.** Four services must be updated in lockstep on the consumer side. A future 5th send-service is a code-review concern.

### Integration test scenarios worth covering

1. Internal account, templated path → no slash added.
2. Internal account, templated query → slash added.
3. Internal account, file-extension path (`.pdf`, `.jpg`) → no slash.
4. External account, any URL → no slash added.
5. Mixed content in a single email body — user links modified, bmsclick wrapper URL itself not modified.

## Implementation Phases

### Phase 0 — Pre-flight verification

Resolve open risks before touching any code.

#### 0a. Verify `findWithCleanConfigs` does not strip `isInternal`

- **Where:** `apps/msgops-api/src/modules/accounts/accounts.service.ts` (the `findWithCleanConfigs` implementation — inspect the field-allow-list / projection step).
- **Action:** add a unit test asserting that the method's return value preserves `isInternal` from the Account entity. If the helper strips unknown fields, extend its allow-list.
- **Blocker if:** the helper requires an allow-list update that cascades beyond this feature — escalate before continuing.

#### 0b. Verify `leadStateMessage.account.isInternal` is populated upstream

- **Where:** trace back from `apps/message-trigger/src/app.service.ts:606-653` to the producer(s) of `leadStateMessage` (likely `lead-receive` or the automation orchestrator in `msgops-api`).
- **Action:** confirm the upstream publisher forwards `isInternal`. If not, that publisher also needs the enrichment change in Phase 2.

#### 0c. Confirm unsubscribe endpoints tolerate trailing slash

- **Where:** `apps/msgops-api` route definitions for `/unsubscribe/...` endpoints.
- **Action:** spot-check in dev that `curl /unsub/xyz/` returns the same response as `curl /unsub/xyz`. If not, add a path-prefix skip in Phase 3a.

#### 0d. Analytics stakeholder notice

- Ping retention analytics that internal-account click URLs will begin reporting with a canonical slash. Confirm no dashboard is hard-keyed on slash-less form.

### Phase 1 — Ship `@msgops/url-utils` package

**Directory layout** (mirrors `packages/shared/`):

```
packages/url-utils/
  package.json
  tsconfig.json
  src/
    index.ts
    add-trailing-slash.ts
    add-trailing-slash.spec.ts
```

#### `packages/url-utils/package.json`

```jsonc
{
  "name": "@msgops/url-utils",
  "private": true,
  "version": "0.0.0",
  "sideEffects": false,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js",
      "import": "./dist/index.js",
      "default": "./dist/index.js",
    },
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "test": "jest",
    "type-check": "tsc --noEmit",
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.ts$": "ts-jest" },
    "testEnvironment": "node",
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.7.0",
  },
}
```

#### `packages/url-utils/tsconfig.json`

```jsonc
{
  "extends": "../typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "CommonJS",
    "moduleResolution": "Node10",
  },
  "include": ["src"],
}
```

#### `packages/url-utils/src/index.ts`

```ts
export * from './add-trailing-slash';
```

#### `packages/url-utils/src/add-trailing-slash.ts`

```ts
// Returns url unchanged when any skip rule matches; otherwise inserts '/'
// immediately before the first '?' or '#', or appends if neither exists.
//
// Callers must pass a normalised (trimmed) URL string.
export function addTrailingSlash(url: string): string {
  // Skip non-web schemes (mailto/tel/sms links commonly appear in email HTML).
  const lower = url.toLowerCase();
  if (lower.startsWith('mailto:') || lower.startsWith('tel:') || lower.startsWith('sms:')) {
    return url;
  }

  // Find the first '?' or '#' — that's where the path ends.
  const queryIdx = url.indexOf('?');
  const hashIdx = url.indexOf('#');
  const boundary =
    queryIdx === -1 ? (hashIdx === -1 ? url.length : hashIdx) : hashIdx === -1 ? queryIdx : Math.min(queryIdx, hashIdx);

  const pathPart = url.slice(0, boundary);
  const suffix = url.slice(boundary);

  // Skip path-segment templates (query templates are fine).
  if (pathPart.includes('{{')) return url;

  // Already has a trailing slash on path.
  if (pathPart.endsWith('/')) return url;

  // Last segment looks like a file extension (.ext at the very end,
  // 1-8 alphanumeric chars). Correctly lets '/v1.2/users' through.
  if (/\.[A-Za-z0-9]{1,8}$/.test(pathPart)) return url;

  return `${pathPart}/${suffix}`;
}
```

#### `packages/url-utils/src/add-trailing-slash.spec.ts`

```ts
import { addTrailingSlash } from './add-trailing-slash';

describe('addTrailingSlash', () => {
  const cases: Array<[string, string, string]> = [
    ['adds slash before query', 'https://example.com/lp?utm=x', 'https://example.com/lp/?utm=x'],
    ['idempotent when slash present', 'https://example.com/lp/?utm=x', 'https://example.com/lp/?utm=x'],
    ['adds slash before hash', 'https://example.com/lp#s', 'https://example.com/lp/#s'],
    ['adds slash before query with hash', 'https://example.com/lp?a=1#s', 'https://example.com/lp/?a=1#s'],
    ['adds slash when first token is ? (multi-?)', 'https://example.com/lp?a=?b', 'https://example.com/lp/?a=?b'],
    ['skips file extension', 'https://example.com/file.pdf?utm=x', 'https://example.com/file.pdf?utm=x'],
    ['skips xml extension', 'https://example.com/sitemap.xml', 'https://example.com/sitemap.xml'],
    [
      'allows dotted segment that is not the last segment',
      'https://example.com/v1.2/users?a=1',
      'https://example.com/v1.2/users/?a=1',
    ],
    ['adds slash to bare host', 'https://example.com', 'https://example.com/'],
    ['idempotent on bare host with slash', 'https://example.com/', 'https://example.com/'],
    ['allows template in query', 'https://example.com/p?id={{contact.id}}', 'https://example.com/p/?id={{contact.id}}'],
    ['skips template in path', 'https://example.com/u/{{id}}?utm=x', 'https://example.com/u/{{id}}?utm=x'],
    ['skips mailto', 'mailto:a@b.co', 'mailto:a@b.co'],
    ['skips tel', 'tel:+15551234', 'tel:+15551234'],
    ['skips MAILTO (case-insensitive)', 'MAILTO:a@b.co', 'MAILTO:a@b.co'],
  ];

  for (const [name, input, expected] of cases) {
    it(name, () => {
      expect(addTrailingSlash(input)).toBe(expected);
    });
  }

  it('is idempotent for every case', () => {
    for (const [, input] of cases) {
      const once = addTrailingSlash(input);
      expect(addTrailingSlash(once)).toBe(once);
    }
  });
});
```

#### Verification

```bash
pnpm --filter @msgops/url-utils build
pnpm --filter @msgops/url-utils test
pnpm --filter @msgops/url-utils type-check
```

### Phase 2 — Publisher payload enrichment

Goal: every Pub/Sub message emitted toward the four send topics carries `account.isInternal`.

#### 2a. `apps/msgops-api/src/modules/services/services.service.ts`

- `sendEmail()` (line ~85 onward): payload currently passes `account: account` at line 91. With Phase 0a confirmed, `account.isInternal` will survive. If Phase 0a revealed stripping, apply the allow-list fix there instead.
- `sendMobilePush()` (lines 129–156): same check.
- WhatsApp and SMS/Twilio publish paths (trace `TOPIC_NAME_SEND_WHATSAPP`, `TOPIC_NAME_TWILIO_*` or equivalents): same.

#### 2b. `apps/message-trigger/src/app.service.ts`

- `parseleadStateMessageToSendEmailMessage` (lines 606–642): line 639 already forwards `account: leadStateMessage.account`. Phase 0b confirmed upstream populates `isInternal`, so no change needed here beyond type alignment.
- `parseleadStateMessageToSendNotification` (lines 644+) and WhatsApp/SMS equivalents: same.

#### Verification

- Integration test: publish a sample message for an internal and an external account; consume from each send-service's test harness; assert `account.isInternal` has the expected value on both.

### Phase 3 — Consumer integration (all four services)

Same pattern across all four services. Ship as one PR covering all of them to preserve lockstep rollout, or four small parallel PRs if code review prefers — either is acceptable.

For each service:

1. **Extend the local `Account` interface** (add `isInternal?: boolean` to the existing interface — the `?` is load-bearing during rollout; see Phase 5 for tightening).
2. **Add `@msgops/url-utils` as a dependency:**
   ```bash
   pnpm --filter send-email add @msgops/url-utils@workspace:*
   pnpm --filter send-push add @msgops/url-utils@workspace:*
   pnpm --filter send-whatsapp add @msgops/url-utils@workspace:*
   pnpm --filter twilio-messaging add @msgops/url-utils@workspace:*
   ```
3. **Import the helper:** `import { addTrailingSlash } from '@msgops/url-utils';`
4. **Apply the gated call** at the service's single URL-finalisation point.
5. **Add a focused spec** asserting internal-account → slash, external → no slash.

#### 3a. `send-email`

- Interface: `apps/send-email/src/interfaces.ts` — add `isInternal?: boolean;` inside `Account` (after line 142).
- Call site: `apps/send-email/src/mail/mail.utils.ts`, inside `createEmailPixel()` (lines 356–500).
  Insert **after** the account-16/message-555704 override block ending around line 454 and **before** the bmsclick wrapping step around line 482:
  ```ts
  auxOriginalLink = options.account?.isInternal ? addTrailingSlash(auxOriginalLink) : auxOriginalLink;
  ```
- If Phase 0c revealed unsubscribe routes are slash-strict, add a guard:
  ```ts
  const isUnsubscribe = auxOriginalLink.includes('/unsub');
  // skip addTrailingSlash when isUnsubscribe
  ```
- Spec: add to the existing `apps/send-email/src/mail/mail.utils.spec.ts` (create if absent): internal → slashed; external → unchanged.

#### 3b. `send-push`

- Interface: `apps/send-push/src/interfaces.ts` — add `isInternal?: boolean;` (after line 82).
- Call site: `apps/send-push/src/app.service.ts`, `addDefaultUTMs()` (lines 334–366). Replace the final return:
  ```ts
  const finalUrl = `${url.origin}${url.pathname}?${queryString}`;
  return account.isInternal ? addTrailingSlash(finalUrl) : finalUrl;
  ```
- Spec: add to `apps/send-push/src/app.service.spec.ts`.

#### 3c. `send-whatsapp`

- Interface: `apps/send-whatsapp/src/interfaces.ts` — add `isInternal?: boolean;` (after line 85).
- **Rename + resignature** `createRedictLink` → `createRedirectLink` in `apps/send-whatsapp/src/app.service.ts` (lines 127–139) with an options object:

  ```ts
  interface CreateRedirectLinkOptions {
    url: string;
    utmsDefault: string;
    type: string;
    utmCampaign: string;
    baseUrl: string;
    account: Account; // required
  }

  async createRedirectLink(opts: CreateRedirectLinkOptions) {
    let { url } = opts;
    const { utmsDefault, type, utmCampaign, baseUrl, account } = opts;

    url += url.includes('?') ? `&${utmsDefault}` : `?${utmsDefault}`;
    if (!url.includes('utm_source')) url += '&utm_source=bms';
    if (!url.includes('utm_medium')) url += `&utm_medium=${type}`;
    if (!url.includes('utm_campaign')) url += `&utm_campaign=${utmCampaign}`;

    if (account.isInternal) url = addTrailingSlash(url);

    return await this.msgopsService.createShortLink(url, baseUrl);
  }
  ```

- **Update all callers** (research found invocations around lines 39 and 68). Thread `account` through from the consumed message. TypeScript `strict` will flag every missing update.
- Spec: add to `apps/send-whatsapp/src/app.service.spec.ts`.

#### 3d. `twilio-messaging`

Mirror §3c against `apps/twilio-messaging/src/interfaces.ts` (line ~85) and `apps/twilio-messaging/src/app.service.ts` (lines 212–224). Same rename, same options-object shape, same caller threading.

#### Phase 3 verification

- `pnpm type-check` at repo root — must pass.
- `pnpm test` at repo root — must pass.
- Deploy to staging; send one campaign per channel against one internal and one external account; verify click URLs manually.

### Phase 4 — Production rollout

- Deploy Phase 3 per standard promotion. The change is reversible per service by reverting the single ternary.
- Monitor ClickHouse click-volume on internal-account campaigns for 24h post-deploy. If volume drops by >5%, revert and investigate destination-server slash tolerance.

### Phase 5 — Tighten `isInternal` to required (follow-up)

Once Phase 4 has been stable in production for two weeks and logs confirm `isInternal` is always present on inbound payloads, promote the type:

- `apps/{send-email,send-push,send-whatsapp,twilio-messaging}/src/interfaces.ts`: change `isInternal?: boolean` → `isInternal: boolean`.
- `apps/message-trigger/src/interfaces.ts:45`: same.
- Consumer call sites can drop the `?.` defensive access.

Tracked as a follow-up ticket, not part of the main PR — but planned now so it does not get forgotten.

## Acceptance Criteria

### Functional

- [ ] `addTrailingSlash` behaviour matches every row of the decision table in the design doc.
- [ ] `msgops-api` publishes `account.isInternal` on all four send-topic messages.
- [ ] `message-trigger` forwards `account.isInternal` intact on all four send-topic messages.
- [ ] Each of the four consumer services calls `addTrailingSlash` iff `account.isInternal === true`.
- [ ] External-account outbound URLs are bit-for-bit unchanged relative to pre-change output.
- [ ] `createRedirectLink` options-object signature is adopted in both WhatsApp and Twilio; all callers pass `account`.

### Quality gates

- [ ] `pnpm test` passes at the repo root.
- [ ] `pnpm type-check` passes at the repo root.
- [ ] `pnpm lint` passes at the repo root.
- [ ] Phase 0a unit test on `findWithCleanConfigs` green.
- [ ] One focused per-service spec (internal vs external) green.
- [ ] Pre-push hook green: `turbo run lint type-check --filter='[HEAD^1]'`.

### Rollout

- [ ] Phase 0 complete before Phase 1 begins.
- [ ] Phase 1–2 merged before Phase 3.
- [ ] Phase 3 reversible by reverting the ternary per service.
- [ ] Phase 5 follow-up ticket filed.

## Success Metrics

- Internal-account landing-page analytics consolidate onto the canonical-slash URL form (visible in ClickHouse / retention dashboards).
- Zero regression in delivery / click-through counts for external accounts.
- No uptick in 4xx/5xx on internal landing pages post-deploy.

## Dependencies & Risks

### Dependencies

- Account entity exposes `isInternal`. Confirmed — `apps/msgops-api/src/entities/account.entity.ts` has `@Column('boolean', { name: 'is_internal', default: false })`.
- `findWithCleanConfigs` preserves `isInternal`. **Verified in Phase 0a.**
- Upstream producers of `leadStateMessage` populate `account.isInternal`. **Verified in Phase 0b.**
- Internal landing pages tolerate or 301-redirect slash-ful URLs. **Verified in Phase 0c.**

### Risks

- **Risk:** landing page returns 404 on `/path/` where `/path` worked. **Mitigation:** Phase 0c dev check; Phase 4 24h monitoring window.
- **Risk:** WhatsApp/Twilio caller misses the options-object signature change. **Mitigation:** TypeScript `strict` flags missing args at build; `pnpm type-check` must pass.
- **Risk:** Analytics keyed on exact destination URL splits internal-account metrics. **Mitigation:** Phase 0d stakeholder notice; landing-page 301 (if present) consolidates over time.

## Sources & References

### Origin

- **Design doc:** [`docs/plans/2026-04-17-feat-trailing-slash-internal-accounts-design.md`](2026-04-17-feat-trailing-slash-internal-accounts-design.md). Key decisions carried forward:
  1. Pure function + caller-side gating (reconsidered post-review; see Technical Considerations note).
  2. Skip path templates `{{...}}` but allow query-param templates.
  3. Apply slash to the destination URL **before** bmsclick wrapping in email; before short-link creation in WhatsApp/Twilio.

### Internal references

- Account entity + `is_internal` column: `apps/msgops-api/src/entities/account.entity.ts`.
- Email URL construction: `apps/send-email/src/mail/mail.utils.ts:356-500`.
- Push URL construction: `apps/send-push/src/app.service.ts:334-366`.
- WhatsApp URL construction: `apps/send-whatsapp/src/app.service.ts:127-139`.
- Twilio URL construction: `apps/twilio-messaging/src/app.service.ts:212-224`.
- Shared package layout reference: `packages/shared/` (used as template for new `packages/url-utils/`).
- Pub/Sub publish: `apps/msgops-api/src/modules/services/services.service.ts` (`sendEmail`, `sendMobilePush`, and WhatsApp/SMS equivalents).
- LeadStateMessage forwarding: `apps/message-trigger/src/app.service.ts:606-653` and `apps/message-trigger/src/interfaces.ts:31-46`.
- ClickHouse events schema: `docs/clickhouse-schema.md`.
- Build/test orchestration: root `turbo.json`, root `package.json`, `lefthook.yml`.
