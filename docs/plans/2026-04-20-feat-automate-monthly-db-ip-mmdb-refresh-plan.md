---
title: Automate monthly DB-IP MMDB refresh for geolocation service
type: feat
status: shipped
date: 2026-04-20
linear: PDBR-125
linear_url: https://linear.app/etus-media/issue/PDBR-125/automate-monthly-db-ip-mmdb-refresh-for-geolocation-service
---

# Automate monthly DB-IP MMDB refresh for geolocation service

## Overview

Replace the manual monthly sequence (download DB-IP Full MMDB → upload to GCS → wait for next Cloud Run deploy) with an idempotent, scheduled GitHub Actions workflow that downloads, verifies, archives, uploads, and triggers a fresh Cloud Run revision for both `msgops-geolocation` services (staging and production). Stale MMDB data silently degrades the new MMDB-based bot-detection pipeline shipped in PR #33; a missed month is invisible until someone notices.

Chosen implementation: **Option C** from PDBR-125 (GitHub Actions cron + existing `GCP_SA_KEY` auth), with **Option B** (Cloud Run Job + Scheduler) as the documented upgrade path if runner reliability proves insufficient. WIF is the recommended auth upgrade once the retention team has an infra pass to provision it — `google-github-actions/auth@v2` supports swapping auth method with a one-step change.

## Problem Statement

The geolocation service loads `dbip-full.mmdb` from GCS (bucket `geoip-mmdb` in prod, `geoip-stg` in staging) mounted read-only via gcsfuse CSI at `/geoip`. The file is read once at process boot via `readFileSync`, parsed into an in-memory `mmdb-reader`, and never re-read.

The MMDB powers two call paths:

1. **Geolocation**: country / region / city fields on `LocationResponse` (historical).
2. **Bot classification (new)**: `traits.autonomous_system_number` + `traits.user_type` feed the `BotDetector` in event-process, which gates `is_bot` / `is_datacenter` / `bot_click` / `datacenter_click` signals. See `apps/event-process/docs/plans/2026-04-20-bot-detection-mmdb-refactor.md` (decision 2) and PR #33.

Today's refresh is fully manual:

1. Download the current DB-IP Full MMDB from the subscriber portal (account key held by @filipe).
2. `gunzip`, verify locally, `gsutil cp` to the two buckets.
3. Trigger a Cloud Run revision rollout (usually by re-running an unrelated deploy).

Manual cadence means drift. Three concrete risks:

- **Silent staleness**: re-assigned IP blocks misclassify — e.g. the bot-detection plan found three Yahoo CIDRs that were already stale in DB-IP's April 2026 data. The same drift happens month over month with the full MMDB.
- **Precision decay**: `is_bot` / `is_datacenter` precision erodes; metrics degrade without any visible failure.
- **Missed month → invisible**: no alert fires when a month is skipped.

## DB-IP API — how downloads actually work

Critical: the DB-IP download URL is **not** a static `https://download.db-ip.com/key/<token>/dbip-full-YYYY-MM.mmdb.gz` pattern. The subscriber API is a small JSON endpoint:

```
GET https://db-ip.com/account/<ACCOUNT_KEY>/db/<dbType>/<format>
```

- `dbType` = `ip-to-full-v4` (the Full MMDB we license)
- `format` = `mmdb`

Response is JSON:

```json
{
  "name": "dbip-full-YYYY-MM.mmdb.gz",
  "url": "<pre-signed CDN URL>",
  "md5sum": "...",
  "sha1sum": "...",
  "date": "YYYY-MM-DD",
  "version": "...",
  "rows": 123456
}
```

- **Downloads go to `fileInfo.url`**, which is a pre-signed/token-embedded CDN URL returned by the API — not constructable from the account key alone.
- **MD5 + SHA1 checksums come from the API response** — this is a free, authoritative integrity check that replaces any ad-hoc size/parse validation.
- **`?new=1` query param** makes the API return empty (no body) if no new file has been published since the account's last successful fetch. Useful signal for "should I download?" — but the server tracks this per account-key, which is a problem when we have two environments (staging + prod) fetching through the same key and racing each other. We use explicit archive-based idempotency instead.
- Reference: `~/Downloads/dbip-phpsrc-4.0/dbip-update.php` (DB-IP's own PHP SDK), particularly `apiRequest()` at line 31 and the download/checksum flow at lines 212–250.

## Proposed Solution

A scheduled GitHub Actions workflow (`.github/workflows/refresh-geoip-mmdb.yml`) that runs daily, is idempotent per-month, and:

1. Resolves target month `YYYY-MM` (UTC).
2. Queries DB-IP's JSON API to get `{name, url, md5sum, sha1sum, date}`.
3. Checks both target buckets for `archive/<fileInfo.name stripped of .gz>` — skips with a success log if already refreshed.
4. Downloads `fileInfo.url` with `curl`, verifies MD5 **and** SHA1 against the API response.
5. `gunzip`, runs a Node validation script (`scripts/validate-mmdb.ts`) that opens the file with `mmdb-reader` and asserts known-good ASNs resolve correctly (defense-in-depth against a corrupt-but-checksum-matching file — unlikely but cheap).
6. Uploads atomically to each bucket: `tmp/<name>-<run-id>.mmdb` → copy to `archive/<name>.mmdb` → copy to canonical `dbip-full.mmdb`, then delete tmp.
7. Triggers a Cloud Run revision rollout per service via `gcloud run services update --update-env-vars DBIP_MMDB_REFRESHED_AT=YYYY-MM` — a spec change that forces a new revision and a fresh gcsfuse mount in each container (no image rebuild).
8. On any failure: post to Slack (new `SLACK_REFRESH_WEBHOOK_URL` secret) with run URL; GH Actions run history is the durable audit trail.

**Design invariant — canonical path stays stable.** The live Cloud Run env var is `DBIP_MMDB_PATH=/geoip/dbip-full.mmdb` (unversioned). This workflow **does not** change the env var per refresh — the canonical object in the bucket is overwritten atomically and versioned copies are kept under `archive/` for rollback. Rationale: avoiding a service-spec change per refresh keeps the blast radius of the refresh job contained and makes rollback a one-command `gsutil cp archive/... dbip-full.mmdb` + rollout.

## Technical Approach

### Architecture

```
                                  .github/workflows/refresh-geoip-mmdb.yml
                                  (cron: 06:00 UTC daily, idempotent per-month)
                                            |
                                            v
                          +----------------------------------+
                          | 1. Query DB-IP JSON API          |
                          |    → {name, url, md5, sha1}      |
                          | 2. gsutil stat archive/<name>    |
                          |    → skip if present (no force)  |
                          | 3. curl fileInfo.url             |
                          | 4. md5sum + sha1sum verify       |
                          | 5. gunzip                        |
                          | 6. node validate-mmdb.ts         |
                          |    (mmdb-reader + fixtures)      |
                          +----------------------------------+
                                            |
                       +--------------------+--------------------+
                       |                                         |
                       v                                         v
       +-------------------------------+         +-------------------------------+
       | Staging:                      |         | Production:                   |
       |   project etus-media-dev...   |         |   project etus-media-prod     |
       |   bucket  geoip-stg           |         |   bucket  geoip-mmdb          |
       |                               |         |                               |
       |   tmp/... -> archive/... ->   |         |   tmp/... -> archive/... ->   |
       |   dbip-full.mmdb (canonical)  |         |   dbip-full.mmdb (canonical)  |
       |                               |         |                               |
       |   gcloud run services update  |         |   gcloud run services update  |
       |   msgops-geolocation          |         |   msgops-geolocation          |
       |   --update-env-vars           |         |   --update-env-vars           |
       |   DBIP_MMDB_REFRESHED_AT=...  |         |   DBIP_MMDB_REFRESHED_AT=...  |
       +-------------------------------+         +-------------------------------+
                                            |
                                            v
                          +----------------------------------+
                          | On any step failure:             |
                          | POST to Slack webhook with       |
                          | run URL + failed step            |
                          +----------------------------------+
```

### Implementation Phases

#### Phase 1 — Secrets + validation fixture

**Scope:** Repo secrets, a validation script, and a committed fixture so the workflow's correctness gate is reviewable.

Tasks:

- Add repo secret `DBIP_ACCOUNT_KEY` (opaque string from DB-IP subscriber portal, held by @filipe).
- Add repo secret `SLACK_REFRESH_WEBHOOK_URL` (new webhook, posts to a retention-ops channel — channel choice is a runbook TODO).
- Confirm existing repo secrets `GCP_SA_KEY_STAGING` and `GCP_SA_KEY` have (or can be granted) the IAM scope needed for MMDB refresh: `roles/storage.objectAdmin` on the bucket + `roles/run.developer` on `msgops-geolocation` + `roles/iam.serviceAccountUser` on the Cloud Run runtime SA. Document the IAM additions in the runbook so ops can apply them explicitly rather than via surprise role-propagation.
- Commit `scripts/validate-mmdb.ts` (Node, uses `mmdb-reader` — same package/version as the geolocation service, pinned in a tiny local `scripts/package.json`).
- Commit `scripts/mmdb-fixtures.json` with known-good assertions:
  ```json
  [
    {
      "ip": "74.125.1.1",
      "expect": { "asn": 15169, "user_type": "hosting", "asn_org_contains": "Google" }
    },
    {
      "ip": "40.107.1.1",
      "expect": { "asn": 8075, "user_type": "hosting", "asn_org_contains": "Microsoft" }
    },
    {
      "ip": "98.136.0.1",
      "expect": { "asn": 7233, "user_type": "hosting", "asn_org_contains": "Yahoo" }
    },
    {
      "ip": "34.138.1.1",
      "expect": { "asn": 396982, "user_type": "hosting", "asn_org_contains": "Google" }
    },
    { "ip": "8.8.8.8", "expect": { "asn": 15169, "asn_org_contains": "Google" } },
    { "ip": "1.1.1.1", "expect": { "asn": 13335, "asn_org_contains": "Cloudflare" } },
    { "ip": "208.67.222.222", "expect": { "asn": 36692, "asn_org_contains": "OpenDNS" } }
  ]
  ```
- Script exits non-zero with a clear error if any fixture misclassifies, if `mmdb-reader` cannot open the file, or if the file size is implausible (< 500 MB or > 3 GB — current April 2026 file is ~1.4 GB).

Fixture choice rationale: mail-scanner ASNs (Google/Microsoft/Yahoo) are the exact ASNs the `BotDetector.MAIL_SCANNER_ASNS` constant keys off (`apps/event-process/src/utils/bot-detector.ts`). A refresh that breaks those keys silently breaks bot detection in prod. Public DNS ASNs (Cloudflare, OpenDNS) round out coverage with stable, well-known values unlikely to be reassigned.

Defense-in-depth note: the DB-IP API-returned MD5 + SHA1 are the authoritative integrity check. The mmdb-reader fixture pass is a _second_ check that catches cases where DB-IP ships a file that parses but misclassifies the ASNs we rely on — e.g., if DB-IP reorganizes `ip-to-full-v4` into a new schema and a key ASN moves, we want a loud failure before overwriting the canonical file.

Deliverables: secrets configured, `scripts/validate-mmdb.ts` + fixture committed and unit-tested.

#### Phase 2 — Refresh workflow

**Scope:** `.github/workflows/refresh-geoip-mmdb.yml`.

Key implementation details:

- Auth via existing `credentials_json: ${{ secrets.GCP_SA_KEY_STAGING | GCP_SA_KEY }}` pattern (matches `.github/workflows/deploy-geolocation.yml`). WIF-upgrade is a one-line swap in `google-github-actions/auth@v2` — deferred.
- Matrix over staging + prod with `fail-fast: false` so one env's failure doesn't mask the other's state.
- `permissions: { contents: read }` — no WIF yet, so no `id-token: write`.
- Single DB-IP API call + download up front, used by both matrix entries (avoids double-download of a 500 MB file). Staging and prod runs use the same bytes; idempotency check and upload are per-env.

Shape:

```yaml
name: Refresh GeoIP MMDB

on:
  schedule:
    - cron: '0 6 * * *' # 06:00 UTC daily; idempotent per-month
  workflow_dispatch:
    inputs:
      month:
        description: 'Override month (YYYY-MM). Leave empty for current UTC month.'
        required: false
        type: string
      force:
        description: 'Force refresh even if archive/ already has this month'
        required: false
        type: boolean
        default: false

permissions:
  contents: read

jobs:
  download:
    name: Download + verify MMDB
    runs-on: ubuntu-latest
    outputs:
      filename: ${{ steps.info.outputs.filename }}
      archive_name: ${{ steps.info.outputs.archive_name }}
      month: ${{ steps.info.outputs.month }}
      skip: ${{ steps.info.outputs.skip }}
    steps:
      - uses: actions/checkout@v4

      - name: Query DB-IP API
        id: info
        env:
          ACCOUNT_KEY: ${{ secrets.DBIP_ACCOUNT_KEY }}
        run: |
          set -euo pipefail
          RESP=$(curl -sSf "https://db-ip.com/account/${ACCOUNT_KEY}/db/ip-to-full-v4/mmdb")
          FILENAME=$(echo "$RESP" | jq -r '.name')         # e.g. dbip-full-2026-04.mmdb.gz
          URL=$(echo "$RESP" | jq -r '.url')
          MD5=$(echo "$RESP" | jq -r '.md5sum')
          SHA1=$(echo "$RESP" | jq -r '.sha1sum')
          DATE=$(echo "$RESP" | jq -r '.date')
          ARCHIVE_NAME=$(echo "$FILENAME" | sed 's/\.gz$//')  # dbip-full-2026-04.mmdb
          MONTH=$(echo "$DATE" | cut -c1-7)                    # 2026-04

          echo "filename=$FILENAME" >> "$GITHUB_OUTPUT"
          echo "archive_name=$ARCHIVE_NAME" >> "$GITHUB_OUTPUT"
          echo "month=$MONTH" >> "$GITHUB_OUTPUT"
          # Pass URL/MD5/SHA1 via env, not output — they're sensitive/long
          echo "::add-mask::$URL"
          echo "URL=$URL" >> "$GITHUB_ENV"
          echo "MD5=$MD5" >> "$GITHUB_ENV"
          echo "SHA1=$SHA1" >> "$GITHUB_ENV"

      - name: Download gzipped MMDB
        run: curl -sSfL -o dbip.mmdb.gz "$URL"

      - name: Verify MD5
        run: |
          ACTUAL=$(md5sum dbip.mmdb.gz | cut -d' ' -f1)
          [ "$ACTUAL" = "$MD5" ] || { echo "::error::md5 mismatch: $ACTUAL != $MD5"; exit 1; }

      - name: Verify SHA1
        run: |
          ACTUAL=$(sha1sum dbip.mmdb.gz | cut -d' ' -f1)
          [ "$ACTUAL" = "$SHA1" ] || { echo "::error::sha1 mismatch: $ACTUAL != $SHA1"; exit 1; }

      - name: Gunzip
        run: gunzip dbip.mmdb.gz

      - name: Validate MMDB with mmdb-reader fixtures
        working-directory: scripts
        run: |
          pnpm install --frozen-lockfile
          pnpm tsx validate-mmdb.ts ../dbip.mmdb mmdb-fixtures.json

      - name: Upload artifact for per-env jobs
        uses: actions/upload-artifact@v4
        with:
          name: dbip-mmdb
          path: dbip.mmdb
          retention-days: 1

  upload:
    name: Upload + rollout (${{ matrix.target.env }})
    needs: download
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        target:
          - env: staging
            project: etus-media-development-staging
            bucket: geoip-stg
            sa_key: GCP_SA_KEY_STAGING
          - env: production
            project: etus-media-prod
            bucket: geoip-mmdb
            sa_key: GCP_SA_KEY
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dbip-mmdb

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets[matrix.target.sa_key] }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Skip if already refreshed this month
        id: guard
        env:
          BUCKET: ${{ matrix.target.bucket }}
          ARCHIVE_NAME: ${{ needs.download.outputs.archive_name }}
          FORCE: ${{ inputs.force }}
        run: |
          if [ "$FORCE" = "true" ]; then echo "skip=false" >> "$GITHUB_OUTPUT"; exit 0; fi
          if gsutil -q stat "gs://${BUCKET}/archive/${ARCHIVE_NAME}"; then
            echo "::notice::Already refreshed: gs://${BUCKET}/archive/${ARCHIVE_NAME}"
            echo "skip=true" >> "$GITHUB_OUTPUT"
          else
            echo "skip=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Upload to GCS (tmp → archive → canonical)
        if: steps.guard.outputs.skip != 'true'
        env:
          BUCKET: ${{ matrix.target.bucket }}
          ARCHIVE_NAME: ${{ needs.download.outputs.archive_name }}
          RUN_ID: ${{ github.run_id }}
        run: |
          set -euo pipefail
          TMP="gs://${BUCKET}/tmp/${ARCHIVE_NAME%.mmdb}-${RUN_ID}.mmdb"
          ARCHIVE="gs://${BUCKET}/archive/${ARCHIVE_NAME}"
          CANON="gs://${BUCKET}/dbip-full.mmdb"
          gsutil -h "Content-Type:application/octet-stream" cp dbip.mmdb "$TMP"
          gsutil cp "$TMP" "$ARCHIVE"
          gsutil cp "$TMP" "$CANON"
          gsutil rm "$TMP"

      - name: Trigger Cloud Run revision rollout
        if: steps.guard.outputs.skip != 'true'
        env:
          PROJECT: ${{ matrix.target.project }}
          MONTH: ${{ needs.download.outputs.month }}
        run: |
          gcloud run services update msgops-geolocation \
            --region=us-east1 \
            --project="$PROJECT" \
            --update-env-vars="DBIP_MMDB_REFRESHED_AT=${MONTH}"

  notify:
    name: Slack on failure
    needs: [download, upload]
    if: failure()
    runs-on: ubuntu-latest
    steps:
      - env:
          WEBHOOK: ${{ secrets.SLACK_REFRESH_WEBHOOK_URL }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          curl -sS -X POST -H 'Content-Type: application/json' \
            -d "{\"text\":\":rotating_light: GeoIP MMDB refresh failed. Run: ${RUN_URL}\"}" \
            "$WEBHOOK"
```

Deliverables: workflow merged, first daily run successfully no-ops (current month already archived via backfill in Phase 4), next month's run executes end-to-end.

#### Phase 3 — Runbook + cross-links

Tasks:

- `infra/geoip-mmdb/README.md` (new) — IAM bindings to apply, secret names, manual dispatch, rollback, fixture rotation, bucket lifecycle rules.
- Cross-link in `apps/geolocation/README.md`: MMDB refresh cadence section → runbook.
- Bucket lifecycle rules to apply manually (documented in runbook):
  - `tmp/` objects: delete after 1 day
  - `archive/` objects: delete after 180 days (6-month rollback window)

Deliverables: runbook merged, geolocation README cross-links.

#### Phase 4 — Cutover & observability

Tasks:

- Apply IAM bindings per the runbook.
- Add secrets `DBIP_ACCOUNT_KEY` + `SLACK_REFRESH_WEBHOOK_URL`.
- Apply bucket lifecycle rules (`tmp/` + `archive/`).
- Backfill `archive/dbip-full-2026-04.mmdb` in both buckets so the idempotency guard correctly no-ops on day one.
- Dispatch the workflow manually with `force=true` against staging only (requires a temporary matrix edit to drop the prod entry, or a dedicated staging-only workflow dispatch — see runbook for the tested path).
- Monitor first real monthly run (2026-05-01 → 06:00 UTC 2026-05-02 is the first scheduled run that will actually do work).
- Add a weekly glance check to the retention team's runbook: "is `archive/dbip-full-<current-month>.mmdb` present in `geoip-mmdb`?" — backstop if the Slack alert channel gets muted.

Deliverables: first automated monthly refresh completes successfully; retention team runbook updated.

## Alternative Approaches Considered

**Option A — Refresh endpoint on the geolocation service.** Rejected: entangles ops with a hot-path request-serving service, requires privilege expansion (`roles/storage.objectAdmin` on the running Cloud Run SA), and the in-memory reload path is either racy or equivalent to the revision-rollout we already get from Option C.

**Option B — Cloud Run Job + Cloud Scheduler.** Viable; documented as the upgrade path. Rejected for v1 because: (a) it introduces a new runnable, scheduler, and IAM binding we don't otherwise need, (b) GH Actions run history gives us an auditable timeline for free, (c) we don't yet have evidence of GH runners failing to reach DB-IP. Migration is mechanical — the validate + upload + rollout logic is identical, only the trigger + runtime change.

**WIF for v1.** Deferred — existing `GCP_SA_KEY` pattern is fine as a starting point; the `google-github-actions/auth@v2` action supports both, so the swap is a single step change when retention has an infra pass to provision pool + provider.

**In-memory MMDB reload (no revision rollout).** Rejected as out of scope per the issue. Would let us refresh without a rollout but requires a swap-safe reload of the `MMDBReader` instance under a read lock (or double-buffer pattern). Not worth the complexity given monthly cadence and Cloud Run cold-start latency.

**Versioned canonical filename (`DBIP_MMDB_PATH=/geoip/dbip-full-YYYY-MM.mmdb`).** Considered: would make every file immutable and content-addressable. Rejected: every refresh would require a Cloud Run service-spec change to update the env var path, and that couples the refresh job's failure modes to Cloud Run deploy failure modes. Keeping the canonical filename stable with `archive/` for rollback is simpler and has the same forensic properties.

**Using DB-IP's `?new=1` for idempotency.** Considered: cleaner than archive-probing. Rejected: the `?new=1` check is per-account-key and tracks "last successful download" server-side — which races when two envs fetch through the same key. Our per-bucket `archive/` probe is robust to retries and environment splits.

## System-Wide Impact

### Interaction Graph

```
Schedule (cron 06:00 UTC daily)
   -> refresh-geoip-mmdb workflow
      -> download job
         -> curl DB-IP JSON API (ACCOUNT_KEY)
         -> curl pre-signed CDN URL
         -> md5sum + sha1sum verify
         -> gunzip
         -> node validate-mmdb.ts (mmdb-reader + fixtures)
         -> upload dbip.mmdb artifact
      -> upload job matrix (staging, production, fail-fast=false)
         -> download artifact
         -> gcloud auth (GCP_SA_KEY_STAGING / GCP_SA_KEY)
         -> gsutil stat archive/ (idempotency guard)
         -> gsutil cp tmp/ -> archive/ -> canonical
         -> gcloud run services update (DBIP_MMDB_REFRESHED_AT env bump)
            -> new Cloud Run revision with same image
               -> fresh gcsfuse mount
                  -> Node process starts -> readFileSync(/geoip/dbip-full.mmdb)
                     -> new MMDBReader instance serves all subsequent RPCs
      -> notify job (if any job failed)
         -> curl Slack webhook
```

Two levels deep: a successful run results in a new Cloud Run revision receiving 100% traffic. In-flight RPCs on the previous revision finish on the old MMDB; new RPCs hit the new MMDB. Cloud Run's default rollout is not blue/green with smoothing, but the cold-start time is dominated by the ~1.4 GB `readFileSync` — expect a brief bump in p99 latency on the first few requests to the new revision. Acceptable for monthly cadence.

### Error & Failure Propagation

| Failure                                   | Propagation                                                    | Handling                                                               |
| ----------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| DB-IP API unreachable / non-2xx           | `download` job fails                                           | `notify` job fires Slack. Tomorrow's cron retries                      |
| DB-IP returns the _same_ file as last run | MD5+SHA1 verify passes; archive guard skips both envs          | Green no-op, no Slack                                                  |
| MD5 or SHA1 mismatch                      | `download` fails before any GCS write                          | Slack alert; human investigates (corruption vs DB-IP bug)              |
| Validation fixture fails                  | `download` fails before any GCS write                          | Slack alert; canonical files untouched                                 |
| Artifact download in `upload` job fails   | one matrix entry fails, other proceeds                         | `notify` fires; partial state possible (see below)                     |
| GCS `tmp/` upload fails                   | that env's canonical untouched                                 | Slack alert; orphan `tmp/` cleaned by lifecycle rule                   |
| `archive/` copy succeeds, canonical fails | archive exists → next run guard skips → manual `gsutil cp` fix | Slack alert; runbook rollback procedure                                |
| `gcloud run services update` fails        | new file is live in bucket, service still running old revision | Slack alert; manual `gcloud run services update` or next deploy        |
| Slack webhook fails                       | swallowed (no cascading failure)                               | Workflow exit code reflects real failure; run history is authoritative |

**Retry conflicts:** none. Each step is idempotent on retry (`gsutil cp` overwrites by default, `run services update` to the same env value is a no-op — we change the value once per month by design).

### State Lifecycle Risks

- **Partial failure leaves `archive/` written but canonical stale.** By design: next scheduled run sees `archive/<name>.mmdb` exists → skips. Mitigation: `workflow_dispatch` with `force=true` retries both copies.
- **One env succeeds, other fails.** Matrix `fail-fast: false` is intentional — we want staging to succeed even if prod auth is broken (or vice-versa). Slack alert fires for the failing env. Next cron retries the failed env only (archive guard skips the succeeded env).
- **Orphaned `tmp/` objects on failure.** Mitigation: bucket lifecycle rule — delete objects under `tmp/` older than 1 day.
- **Unbounded archive growth.** At ~1.4 GB/month, 1 year ≈ 17 GB. Mitigation: lifecycle rule — delete `archive/` older than 180 days (6 prior months).
- **Cold-start spike on the new revision.** Known; not this plan's concern to solve. Called out as acceptable; monitor p99 on release day if paranoid.

### API Surface Parity

No API surface changes. The geolocation service's gRPC contract is unchanged. The only observable effect is that `LocationResponse.traits.asn` and friends resolve against a fresher dataset after each monthly rollout.

### Integration Test Scenarios

Cross-layer scenarios that unit tests on `validate-mmdb.ts` alone would not catch:

1. **Happy path end-to-end, staging only.** Dispatch with `force=true` against staging (via a staging-only variant described in runbook). Verify (a) new object in `archive/`, (b) canonical object timestamp changed, (c) new Cloud Run revision created, (d) `/location` RPC for a known Gmail IP returns the expected ASN.
2. **DB-IP API unreachable.** Simulate by rotating `DBIP_ACCOUNT_KEY` to garbage in a test secret; expect download job to fail with clear error; Slack alert fires; no bucket changes.
3. **Checksum mismatch (simulated).** Replace the API's MD5 with a wrong value via a fork; expect download job to fail before any bucket write.
4. **Idempotent replay.** Dispatch without `force` when `archive/<name>.mmdb` exists — expect guard skip, no API calls to DB-IP on the upload side, no Cloud Run update.
5. **Rollback drill.** Manually: `gsutil cp gs://geoip-mmdb/archive/dbip-full-2026-03.mmdb gs://geoip-mmdb/dbip-full.mmdb` followed by `gcloud run services update msgops-geolocation --update-env-vars DBIP_MMDB_REFRESHED_AT=rollback-2026-03`. Verify `/location` RPC reflects the March dataset. Document in runbook.

## Acceptance Criteria

### Functional Requirements

- [x] `.github/workflows/refresh-geoip-mmdb.yml` committed and running on daily cron (`0 6 * * *`).
- [ ] Workflow successfully refreshes staging via `workflow_dispatch force=true`; Cloud Run revision bump observable in `gcloud run revisions list`.
- [x] Workflow is idempotent per-month — second run on the same day skips the upload with a log line, no GCS writes.
- [x] DB-IP returning the same file as a prior run is a no-op (archive guard catches it).
- [x] MD5 and SHA1 verification run before any GCS write.
- [x] Validation fixture failure aborts **before** canonical is overwritten.
- [x] Atomic upload pattern (`tmp → archive → canonical`) completes; `tmp/` removed on success.
- [x] `archive/<file>.mmdb` is written for every successful refresh.
- [x] Any failed job posts to `SLACK_REFRESH_WEBHOOK_URL` with run URL.
- [x] Uses existing `GCP_SA_KEY` / `GCP_SA_KEY_STAGING` secrets (no new long-lived key material added).

### Non-Functional Requirements

- [ ] Per-env upload + rollout completes in < 10 min.
- [ ] Download + verify + validate completes in < 15 min for the ~500 MB gzipped payload.
- [ ] Failed run does not leave the canonical bucket object in a half-written state (atomic via tmp-copy).
- [ ] No privilege escalation on the geolocation service itself — `msgops-geolocation`'s Cloud Run runtime SA gains no new roles.
- [ ] Bucket lifecycle rules: `tmp/` objects deleted after 1 day; `archive/` objects deleted after 180 days.

### Quality Gates

- [x] `scripts/validate-mmdb.ts` has unit tests: missing file, implausible size, unparseable bytes, missing fixtures.
- [x] Workflow YAML lint clean (`actionlint`).
- [x] Runbook entry in `infra/geoip-mmdb/README.md` documents: IAM additions, manual dispatch, rollback procedure, account-key rotation, how to add a fixture.
- [ ] Code review approval.

## Success Metrics

- **Zero missed months** — presence of `archive/dbip-full-<month>.mmdb` for every month going forward.
- **Time-to-refresh < 24 h** from DB-IP publication (measured by `archive/` object timestamp vs `fileInfo.date`).
- **Bot-detection precision stability** — `bot_click` / `datacenter_click` rates in `events_statistics` don't drift month-over-month due to stale data. Indirect metric; a concrete dashboard is nice-to-have.

## Dependencies & Prerequisites

- DB-IP account key (held by @filipe) → repo secret `DBIP_ACCOUNT_KEY`.
- Slack webhook URL for retention-ops alerts → repo secret `SLACK_REFRESH_WEBHOOK_URL`.
- Existing `GCP_SA_KEY` + `GCP_SA_KEY_STAGING` granted additional IAM (runbook).
- Bucket lifecycle rules applied (runbook).
- PR #33 (`f10d01768`) merged — this plan is strictly additive.

## Risk Analysis & Mitigation

| Risk                                                   | Likelihood | Impact                                 | Mitigation                                                                                                                                                                                      |
| ------------------------------------------------------ | ---------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB-IP publishes late (file not available on day 1)     | High       | No refresh on month-1                  | Daily cron + archive idempotency guard → runs every day until new file appears (archive name is derived from API response, so a new month's file means a new archive name → guard doesn't skip) |
| DB-IP account key revoked / expired                    | Low        | Refresh fails daily                    | Slack alert daily; owner rotates. Daily cadence → self-healing once rotated                                                                                                                     |
| GH runner can't reach DB-IP                            | Low        | Refresh fails                          | Escalate to Option B (Cloud Run Job)                                                                                                                                                            |
| Fixture becomes stale (e.g., 74.125.1.1 reassigned)    | Medium     | False-positive validation failure      | Fixtures pinned to stable, publicly-documented IPs; review quarterly; fallback to ASN-only assertion for most volatile entries                                                                  |
| `mmdb-reader` version skew between scripts and service | Low        | Validation lies about prod behavior    | Pin `mmdb-reader` in `scripts/package.json` to the same version in `apps/geolocation/package.json` (`^1.2.0`). CI check for drift                                                               |
| DB-IP MMDB schema change breaks `mmdb-reader`          | Very low   | Validation fails on fresh file         | Fail-loud is correct: a schema change would break the running service too                                                                                                                       |
| Service-account key leaked via the JSON secret         | Medium     | Bucket + Cloud Run compromised         | IAM scoped narrowly in runbook; plan WIF upgrade explicitly                                                                                                                                     |
| gcsfuse cache staleness delays file pickup             | Very low   | New revision briefly serves old traits | Cold-start → fresh mount; readOnly=true with no client cache                                                                                                                                    |
| `gcloud run services update` fails mid-rollout         | Low        | New file live, old revision serving    | Slack alert; manual re-run; runbook documents the retry                                                                                                                                         |
| Rollback path untested                                 | Medium     | First real rollback fumbles            | Phase 4 includes a rollback drill on staging                                                                                                                                                    |

## Resource Requirements

- **Team:** one engineer, ~0.5 day implementation + ~0.5 day for Phase 4 ops (IAM, secrets, lifecycle, backfill, staging drill).
- **Infra:** no new Cloud Run services, no new schedulers. One new GH Actions workflow.
- **Cost:** ~$0.04/month GCS (1.4 GB × 7 archives × $0.02/GB-mo during 180-day retention, at steady state). GH Actions minutes: ~5 min × 30 days × 1 download + 2 upload entries ≈ 450 min/month, well under free tier.

## Future Considerations

- **WIF** swap-in once retention has an infra pass — one-line change in `google-github-actions/auth@v2`.
- **Promotion to Option B** (Cloud Run Job + Scheduler) if runner reliability becomes an issue. Validate + upload + rollout logic is identical.
- **MMDB slimming**: country-only MMDB for geo-only callers + full MMDB for bot-detection callers would halve memory + cold-start. Out of scope; workflow architecture accommodates two canonical files trivially.
- **In-memory reload** via swap-safe `MMDBReader` under a read lock, eliminating cold-start latency. Out of scope.
- **Drop DB-IP** for an alternative provider. Workflow's `download` job is the single point of change. Out of scope.

## Documentation Plan

- `infra/geoip-mmdb/README.md` (new) — the runbook.
- `apps/geolocation/README.md` — MMDB refresh cadence section linking runbook.
- `apps/event-process/docs/plans/2026-04-20-bot-detection-mmdb-refactor.md` decision 3 "refresh automation is a follow-up" is fulfilled by this plan — cross-link from that doc.

## Sources & References

### Internal References

- Live Cloud Run spec (production): bucket `geoip-mmdb`, env `DBIP_MMDB_PATH=/geoip/dbip-full.mmdb`, volume mount `/geoip` via gcsfuse CSI (`readOnly: true`).
- Live Cloud Run spec (staging): bucket `geoip-stg`, same mount + env.
- `apps/geolocation/src/app.service.ts:13-25` — `readFileSync` in constructor; no reload path.
- `apps/geolocation/.env.example:6` — `DBIP_MMDB_PATH` convention.
- `apps/event-process/src/utils/bot-detector.ts` — `MAIL_SCANNER_ASNS` constant; validation fixtures must preserve these ASN mappings.
- `apps/event-process/docs/plans/2026-04-20-bot-detection-mmdb-refactor.md` — bot-detection plan; decision 3 documents the Yahoo CIDR staleness evidence.
- `.github/workflows/deploy-geolocation.yml` — existing deploy pattern.
- `.github/workflows/_deploy-cloudrun.yml:82-92` — existing `google-github-actions/auth@v2` + `setup-gcloud` pattern.

### External References

- DB-IP subscriber API: `GET https://db-ip.com/account/<ACCOUNT_KEY>/db/ip-to-full-v4/mmdb` → `{name, url, md5sum, sha1sum, date, version}`. Source: `~/Downloads/dbip-phpsrc-4.0/dbip-update.php:31,212-250`.
- `google-github-actions/auth@v2` WIF path (future upgrade) — https://github.com/google-github-actions/auth#setting-up-workload-identity-federation
- `gcloud run services update --update-env-vars` — https://cloud.google.com/sdk/gcloud/reference/run/services/update
- gcsfuse CSI driver on Cloud Run (readOnly mount semantics) — https://cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts

### Related Work

- Linear: [PDBR-125](https://linear.app/etus-media/issue/PDBR-125/automate-monthly-db-ip-mmdb-refresh-for-geolocation-service) — this issue.
- Linear: PDBR-117 — original `is_bot` investigation.
- GitHub: PR #33 — MMDB-based bot & datacenter click detection.
