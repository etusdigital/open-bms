# GeoIP MMDB refresh — runbook

The DB-IP Full MMDB powers the `msgops-geolocation` service (country/region/city
lookups) and the event-process `BotDetector` (ASN + user_type classification).
Staleness silently degrades bot-detection precision — see plan at
[`docs/plans/2026-04-20-feat-automate-monthly-db-ip-mmdb-refresh-plan.md`](../../docs/plans/2026-04-20-feat-automate-monthly-db-ip-mmdb-refresh-plan.md)
and Linear [PDBR-125](https://linear.app/etus-media/issue/PDBR-125/automate-monthly-db-ip-mmdb-refresh-for-geolocation-service).

The refresh runs automatically on a daily schedule via
`.github/workflows/refresh-geoip-mmdb.yml`. Idempotency is per-month: the first
successful run of each calendar month overwrites `gs://<bucket>/dbip-full.mmdb`
and writes a versioned copy to `gs://<bucket>/archive/dbip-full-YYYY-MM.mmdb`;
subsequent runs that day (and the rest of the month) detect the archive and
skip.

## Live resources

| Env        | GCP project                      | Bucket       | Service                         | Mount path | Env var                                |
| ---------- | -------------------------------- | ------------ | ------------------------------- | ---------- | -------------------------------------- |
| Production | `etus-media-prod`                | `geoip-mmdb` | `msgops-geolocation` (us-east1) | `/geoip`   | `DBIP_MMDB_PATH=/geoip/dbip-full.mmdb` |
| Staging    | `etus-media-development-staging` | `geoip-stg`  | `msgops-geolocation` (us-east1) | `/geoip`   | `DBIP_MMDB_PATH=/geoip/dbip-full.mmdb` |

Both services mount their bucket read-only via gcsfuse CSI. The canonical file
is always `dbip-full.mmdb` (unversioned); versioned copies live under `archive/`.

## One-time setup

### Repo secrets

Add in GitHub → Settings → Secrets and variables → Actions:

- `DBIP_ACCOUNT_KEY` — DB-IP subscriber account key. Find at
  https://db-ip.com/account/ under "API key". Held by @filipe.
- `SLACK_REFRESH_WEBHOOK_URL` — incoming webhook for the retention-ops Slack
  channel (`#retention-ops` — TBD; create the webhook at
  https://api.slack.com/apps).
- `GCP_SA_KEY` and `GCP_SA_KEY_STAGING` already exist for deploys. Ensure the
  service accounts behind them have the IAM bindings listed below.

### IAM bindings

The existing deploy SAs need three extra roles in each project:

```bash
# Replace with the actual SA email behind GCP_SA_KEY / GCP_SA_KEY_STAGING.
# You can inspect the email from the JSON secret's `client_email` field, or
# decode it locally if you keep a copy.
SA_PROD=<deploy-sa>@etus-media-prod.iam.gserviceaccount.com
SA_STAGING=<deploy-sa>@etus-media-development-staging.iam.gserviceaccount.com

# Production
gcloud projects add-iam-policy-binding etus-media-prod \
  --member="serviceAccount:${SA_PROD}" \
  --role="roles/run.developer"

gcloud projects add-iam-policy-binding etus-media-prod \
  --member="serviceAccount:${SA_PROD}" \
  --role="roles/iam.serviceAccountUser"

gsutil iam ch \
  "serviceAccount:${SA_PROD}:roles/storage.objectAdmin" \
  gs://geoip-mmdb

# Staging — repeat with the staging SA + project + bucket
```

`roles/iam.serviceAccountUser` is required on the Cloud Run runtime SA
(`281576158836-compute@developer.gserviceaccount.com`) so that `gcloud run
services update` can re-bind the service spec. Without it the rollout step
fails with a cryptic permission error.

### Bucket lifecycle rules

Apply once per bucket. `tmp/` objects are orphaned upload remnants; `archive/`
holds the rollback window.

```bash
cat > /tmp/geoip-mmdb-lifecycle.json <<'EOF'
{
  "lifecycle": {
    "rule": [
      { "action": { "type": "Delete" },
        "condition": { "age": 1, "matchesPrefix": ["tmp/"] } },
      { "action": { "type": "Delete" },
        "condition": { "age": 180, "matchesPrefix": ["archive/"] } }
    ]
  }
}
EOF

gsutil lifecycle set /tmp/geoip-mmdb-lifecycle.json gs://geoip-mmdb
gsutil lifecycle set /tmp/geoip-mmdb-lifecycle.json gs://geoip-stg
```

Rationale: `tmp/` at age 1 day cleans up failed uploads without racing running
jobs (upload + verify + rollout completes in well under 15 min). `archive/` at
180 days keeps six months of rollback targets, ~8 GB steady-state.

### Seed the archive for the current month

So the first scheduled run after merge correctly no-ops instead of
re-downloading, backfill the current month's archive from whatever is currently
live on `dbip-full.mmdb`:

```bash
# Confirm the canonical filename date (e.g. 2026-04 if live file is April's)
gsutil ls -L gs://geoip-mmdb/dbip-full.mmdb | head

# Production
gsutil cp gs://geoip-mmdb/dbip-full.mmdb gs://geoip-mmdb/archive/dbip-full-2026-04.mmdb

# Staging
gsutil cp gs://geoip-stg/dbip-full.mmdb gs://geoip-stg/archive/dbip-full-2026-04.mmdb
```

## Running manually

GitHub → Actions → "Refresh GeoIP MMDB" → "Run workflow".

Inputs:

- `force` (default `false`) — overwrite canonical + archive even if this
  month's archive already exists. Use for: seeding a fresh bucket, forcing a
  re-download after a suspected corruption.
- `skip_production` (default `false`) — run the staging matrix entry only.
  Use for: validating the full pipeline against staging before any prod
  changes. **Use this when onboarding new secrets, rotating the DB-IP key, or
  any time you're not confident in a change.**

## Rollback

A bad MMDB rollout degrades geolocation + bot detection. To revert to the
previous month:

```bash
# 1. Pick a prior archive
gsutil ls gs://geoip-mmdb/archive/ | tail

# 2. Copy to canonical (overwrite)
gsutil cp gs://geoip-mmdb/archive/dbip-full-2026-03.mmdb \
          gs://geoip-mmdb/dbip-full.mmdb

# 3. Force a new Cloud Run revision to pick up the reverted file
gcloud run services update msgops-geolocation \
  --region=us-east1 \
  --project=etus-media-prod \
  --update-env-vars="DBIP_MMDB_REFRESHED_AT=rollback-2026-03"

# 4. Also consider: revert the archive for the current month so the next
# scheduled refresh retries
gsutil rm gs://geoip-mmdb/archive/dbip-full-2026-04.mmdb
```

Rollback is not reflected anywhere except `DBIP_MMDB_REFRESHED_AT` on the
service. Leave a note in `#retention-ops` and the Linear ticket.

## Rotating the DB-IP account key

1. Log into https://db-ip.com/account/ → API key → regenerate.
2. Update the `DBIP_ACCOUNT_KEY` secret in GitHub.
3. Dispatch the workflow manually with `skip_production=true` to validate.
4. On success, the next scheduled cron uses the new key end-to-end.

## Adding or rotating validation fixtures

`scripts/mmdb-fixtures.json` pins IPs with stable classifications. An IP
becoming unstable is a medium-severity issue — swap it for a similarly stable
one at the same ASN.

- Keep the three mail-scanner ASNs (Google 15169, Microsoft 8075, Yahoo 7233):
  these are load-bearing for bot-detection precision.
- Public DNS IPs (`8.8.8.8`, `1.1.1.1`, `208.67.222.222`) are effectively
  permanent — don't remove without discussion.
- GCP hosting range (e.g. `34.138.1.1`) covers the `is_datacenter` wide
  classification. Replace with another `35.x.x.x` or `34.x.x.x` if it moves.

Every quarter, skim `dbip-update.php`'s changelog and DB-IP release notes for
schema changes. If DB-IP restructures `ip-to-full-v4`, the validator may need
field-path updates in `scripts/validate-mmdb.ts`.

## When this breaks

- **Slack fires daily for a week** — DB-IP account key or API behavior changed.
  Check `#retention-ops` for the run URL, investigate `download` job logs.
- **Slack silent but `archive/` stale** — cron didn't fire, workflow was
  disabled, or Slack webhook broken. Check the Actions tab for recent runs;
  GitHub Actions schedules can skip under load — manually dispatch to recover.
- **Service serves old traits after a successful run** — rollout completed but
  an old revision is still holding traffic. Check `gcloud run revisions list
--service msgops-geolocation` and manually set traffic to the new revision.

## Promoting to Option B (Cloud Run Job)

If GitHub-runner-to-DB-IP network reliability becomes an issue, migrate to a
Cloud Run Job + Cloud Scheduler. The validate + upload + rollout logic in the
workflow is identical — copy it into a container image, trigger via Scheduler,
grant the Job SA the same IAM roles listed above. Budget ~1 day.
