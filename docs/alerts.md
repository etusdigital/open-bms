# Alerts — Anomaly Detection for Email Delivery

## Overview

The alerts system automatically detects anomalies in email delivery metrics by comparing real-time ClickHouse data against statistical baselines (**28-day** for weekdays, **35-day** for weekends) using median + IQR (interquartile range). It covers bounce spikes, deferred spikes, spam complaint spikes, volume drops, and volume spikes.

Alerts are stored in PostgreSQL (`retention_alerts` table), displayed in the frontend dashboard, and can be acknowledged by managers. There are no external notification channels yet (no email/Slack/SMS) — users must check the UI.

### Account Scope

**Currently, alerts only monitor internal accounts.** At the start of each detection run, the system queries the `accounts` table for rows where `is_internal = true` and restricts all ClickHouse queries to those account IDs. External accounts are excluded from anomaly detection entirely. This can be changed by updating the `detectAnomalies` method in `alerts.service.ts` to remove the account filter.

## Statistical Baseline (V2)

### Why Median + IQR instead of AVG

The V1 system used simple 7-day same-hour-of-day averages and multiplier-based thresholds (e.g., 2x = warning). This caused false positives because:

- **AVG is sensitive to outliers**: Data like `[10,10,10,10,10,50,50]` has avg=21.4, so 43 triggers a 2x warning. Median=10, IQR-spread=29.6, so 43 has z-score=1.1 — not anomalous.
- **Weekend zeros drag down weekday averages**: Monday sends looked like spikes.
- **Zero-baseline triggers**: Any value > 0 became a warning when baseline avg was 0.
- **Low minEvents thresholds**: Created noise on low-volume pools.

### How it works

1. **Quantile-based baseline**: Uses ClickHouse `quantiles(0.25, 0.5, 0.75)(metric)` to compute p25, p50 (median), p75 in a single pass.

2. **Spread calculation**: `spread = (p75 - p25) / 1.35` — normalizes IQR to a standard-deviation equivalent.

3. **Z-score**: `z = (current - median) / effectiveSpread` where:

   ```
   effectiveSpread = max(spread, minSpread, median × minSpreadPct)
   ```

   The `minSpreadPct` floor (e.g., 5% or 10% of median) prevents tight-IQR pools (very consistent traffic) from producing extreme z-scores on small absolute changes.

4. **Z-score clamping**: Results are clamped to `[-20, 20]` for human-readable display.

### Weekday/Weekend Split

Baselines are computed separately for weekdays (Mon-Fri) and weekends (Sat-Sun). A detection run on Tuesday only considers historical data from other weekdays; a run on Saturday only uses weekend data. This prevents weekend zeros from contaminating weekday baselines and vice versa.

### 28/35-Day Lookback

Weekday baselines use a **28-day** lookback window, giving ~20 data points for daily senders and at least 4 samples for once-per-weekday senders (e.g., Monday-only). Weekend baselines use a **35-day** window to accumulate enough weekend samples when traffic is sparse. A minimum of **5 historical data points** is required — pools with fewer are skipped entirely. This higher minimum (vs the previous 3) reduces false positives on pools with limited send history.

## Alert Types

### bounce_spike

Detects abnormal increases in email bounces.

| Severity | Condition          |
| -------- | ------------------ |
| Warning  | z-score >= **3.0** |
| Critical | z-score >= **4.5** |

- **Min events**: 200 total events in the current window
- **Absolute floor**: Current bounces must exceed 20
- **Min data points**: 5 historical hours at this time slot
- **Min spread %**: 5% of median (prevents false alerts on low-variance pools)
- **Min abs deviation**: 50 (count-based safety net for bounce counts)
- **Data window**: Current partial hour vs 28-day same-hour-of-day baseline (weekday/weekend split)
- **Metric**: `bounced` column from `tb_email_hourly_stats`

### deferred_spike

Detects abnormal increases in deferred (temporarily failed) deliveries.

| Severity | Condition          |
| -------- | ------------------ |
| Warning  | z-score >= **3.0** |
| Critical | z-score >= **4.5** |

- **Min events**: 200 total events in the current window
- **Absolute floor**: Current deferrals must exceed 50
- **Min data points**: 5
- **Min spread %**: 5% of median
- **Min abs deviation**: 100 (count-based safety net for deferred counts)
- **Data window**: Current partial hour vs 28-day same-hour-of-day baseline (weekday/weekend split)
- **Metric**: `deferred` column from `tb_email_hourly_stats`

### spam_spike

Detects high spam complaint rates relative to delivered volume.

| Severity | Condition                          |
| -------- | ---------------------------------- |
| Warning  | Spam rate >= **0.1%** of delivered |
| Critical | Spam rate >= **0.3%** of delivered |

- **Min events**: 200 total events in the current window
- **Data window**: Current partial hour (rate-based, no baseline needed)
- **Metric**: `spam_reported / delivered * 100`
- **Baseline**: Not used — thresholds are absolute percentages based on industry standards

### volume_drop

Detects abnormal decreases in total email volume (sending may have stopped or been throttled).

| Severity | Condition           |
| -------- | ------------------- |
| Warning  | z-score <= **-4.0** |
| Critical | z-score <= **-6.0** |

- **Absolute floor**: Baseline median must exceed 200 (guards against low-volume accounts)
- **Min data points**: 5
- **Min spread %**: 10% of median (volume naturally varies more than bounce/deferred rates)
- **Min abs deviation**: 0 (disabled — the 10% minSpreadPct floor already ensures meaningful deviations)
- **Data window**: Last completed hour vs 28-day same-hour-of-day baseline (full-to-full comparison)
- **Metric**: `total_events` column from `tb_email_hourly_stats`

Higher z-score thresholds (4.0/6.0) compared to bounce/deferred (3.0/4.5) because volume is naturally more volatile — weekday vs. weekday variance in total sends is higher than in error rates.

#### Why Full-Hour Only (No Pro-Rated Projection)

Earlier versions used pro-rated projection (`currentVolume × 60/minutesElapsed`) to detect drops within the current hour. This was removed because linear projection is fundamentally broken for batch senders — an account that sends in bursts (e.g., 48K emails in the last 20 minutes of an hour) would be projected as sending only 18K at the 40-minute mark, triggering a false volume drop. This pattern caused a **90% false-positive rate** (53 of 59 alerts were noise).

The completed-hour check is reliable because it compares full hours against full-hour baselines. The tradeoff is a maximum ~60-minute delay in detecting volume drops (until the hour completes). Given that volume drops typically indicate systemic issues (throttling, DNS problems, provider outages) rather than momentary blips, this delay is acceptable. Spike detection (bounce, deferred, spam) still uses the current partial hour for real-time alerting.

### volume_spike

Detects abnormal increases in total email volume.

| Severity | Condition          |
| -------- | ------------------ |
| Warning  | z-score >= **4.0** |
| Critical | z-score >= **6.0** |

- **Min events**: 200 total events in the current window
- **Absolute floor**: Current volume must exceed 500
- **Min data points**: 5
- **Min spread %**: 10% of median
- **Min abs deviation**: 0 (disabled — the 10% minSpreadPct floor already ensures meaningful deviations)
- **Data windows**: Two windows
  - **Spike window (partial current hour)**: Raw `total_events` vs spike baseline
  - **Last completed hour**: Full-to-full comparison
- **Metric**: `total_events` column from `tb_email_hourly_stats`

Higher z-score thresholds (4.0/6.0) match `volume_drop` because total volume is naturally volatile.

### block_detected

Reserved for future use. Will detect IP/domain blocks from mailbox providers.

- **Min events**: 10
- **Severity**: Always critical when triggered
- **Not yet implemented** in the anomaly detection loop

## Thresholds Summary

| Type             | Warning z  | Critical z | Min Events | Min Points | Absolute Floor | Spread % Floor | Min Abs Dev |
| ---------------- | ---------- | ---------- | ---------- | ---------- | -------------- | -------------- | ----------- |
| `bounce_spike`   | >= 3.0     | >= 4.5     | 200        | 5          | bounced > 20   | 5%             | 50          |
| `deferred_spike` | >= 3.0     | >= 4.5     | 200        | 5          | deferred > 50  | 5%             | 100         |
| `volume_spike`   | >= 4.0     | >= 6.0     | 200        | 5          | total > 500    | 10%            | 0           |
| `volume_drop`    | <= -4.0    | <= -6.0    | n/a        | 5          | median > 200   | 10%            | 0           |
| `spam_spike`     | n/a (rate) | n/a (rate) | 200        | n/a        | n/a            | n/a            | n/a         |
| `block_detected` | n/a        | n/a        | 10         | n/a        | n/a            | n/a            | n/a         |

Thresholds are defined in `packages/shared/src/thresholds.ts` (`ALERT_THRESHOLDS_V2`) and compiled into both frontend and backend. Changing thresholds requires a rebuild and redeploy.

## Two-Window Detection Strategy

The system uses two data windows optimized for different alert types:

```
Timeline:  ... |----hour 13----|----hour 14----|--now (14:35)
                                                    │
           Spike window ─────────────────────────► [hour 14 partial]
           Completed volume ─────────────► [hour 13 complete]
```

| Window          | ClickHouse Query                                                                                      | Used By                                                |
| --------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Spike current   | `WHERE hour = toStartOfHour(now) AND account_id IN (internal_ids)`                                    | bounce_spike, deferred_spike, spam_spike, volume_spike |
| Spike baseline  | Same hour-of-day, past 28 days (weekday) or 35 days (weekend), `HAVING data_points >= 5`              | bounce_spike, deferred_spike, spam_spike, volume_spike |
| Volume current  | `WHERE hour = toStartOfHour(now) - INTERVAL 1 HOUR AND account_id IN (internal_ids)`                  | volume_drop, volume_spike (completed)                  |
| Volume baseline | Same hour-of-day as completed hour, past 28/35 days, weekday/weekend split, `HAVING data_points >= 5` | volume_drop, volume_spike (completed)                  |

All four queries run in parallel via `Promise.all`.

## Alert Descriptions

All alert descriptions include the UTC hour label in brackets to clarify which data window triggered the alert:

- **Current partial hour alerts**: `[14:00 UTC] Current bounces: 300 (z-score: 8.4), baseline median: 50.0`
- **Completed hour alerts**: `[13:00 UTC] Current volume: 5000 (z-score: -5.2), baseline median: 12000.0`

## Tendency Chart

When viewing an alert's details, the frontend shows a tendency chart with:

- **Time window**: From **26 hours before** to **6 hours after** the detection time — wide enough to show the same hour from the previous day for comparison
- **Visual markers**:
  - **Red dashed vertical line + dot**: The hour when the anomaly was detected
  - **Gray dashed vertical line + dot**: The same hour from the previous day (24h before detection)

This allows managers to quickly compare the anomalous hour against its day-before equivalent.

## Trigger Mechanism

Anomaly detection is **not scheduled internally**. It runs via an external HTTP trigger:

```
POST /internal/cron/detect-anomalies
Header: X-Cron-Secret: <value of CRON_SECRET env var>
```

This endpoint is excluded from JWT authentication and account middleware — it only validates the `X-Cron-Secret` header.

**Recommended frequency**: Every 15 minutes (e.g., :05, :20, :35, :50). The 15-minute cadence ensures timely spike detection (bounce, deferred, spam alerts use the current partial hour). The :05 run also evaluates the completed-hour window for volume drops shortly after the hour turns, giving materialized views time to settle.

### Query parameters

| Param           | Type                | Description                                                                                  |
| --------------- | ------------------- | -------------------------------------------------------------------------------------------- |
| `referenceTime` | string (optional)   | Override `now()` with a ClickHouse datetime, e.g. `2025-02-17T18:30:00`. Useful for testing. |
| `dryRun`        | `"true"` (optional) | Return what alerts would be created without persisting anything.                             |

### Response

```json
{
  "created": 2,
  "resolved": 1,
  "details": [] // Only populated when dryRun=true
}
```

## Alert Lifecycle

```
[Anomaly detected] → Active → Acknowledged → Resolved
                        │                        ▲
                        └── Auto-resolved ───────┘
```

### Statuses

| Status           | Condition                                           | Meaning                                             |
| ---------------- | --------------------------------------------------- | --------------------------------------------------- |
| **Active**       | `resolvedAt IS NULL AND acknowledgedAt IS NULL`     | Anomaly is ongoing and unacknowledged               |
| **Acknowledged** | `acknowledgedAt IS NOT NULL AND resolvedAt IS NULL` | A manager has seen it; anomaly may still be ongoing |
| **Resolved**     | `resolvedAt IS NOT NULL`                            | Anomaly condition no longer met (auto-resolved)     |

### Deduplication

Only one active alert can exist per unique combination of `(accountId, alertType, pool, providerAccount)`. If an alert already exists for that tuple:

- If severity changed (e.g. warning → critical), the existing alert is updated (including `title`, `baselineValue`, `currentValue`, `description`, and `metadata`)
- Otherwise, no new alert is created

### Auto-resolution

After creating/updating alerts, the system checks all active alerts against current data. If the anomaly condition is no longer met (e.g., z-score dropped below threshold), the alert is automatically resolved by setting `resolvedAt = now()`.

Auto-resolution uses the same two-window approach: volume_drop and volume_spike alerts are kept active if **either** window (spike partial hour or completed hour) still triggers. Spike alerts (bounce, deferred, spam) are checked against the current partial-hour window.

### Severity escalation

If an existing active alert's severity changes (e.g., z-score went from 3.5 to 5.0), the system updates the alert's severity, title, baseline value, current value, description, and metadata in place rather than creating a duplicate.

## API Endpoints

### List alerts

```
GET /alerts?page=1&pageSize=20&severity=critical&alertType=bounce_spike&status=active&accountId=123
```

- **Auth**: Bearer JWT, minimum role `VIEWER`
- **Pagination**: `page` (default 1), `pageSize` (default 20)
- **Filters**: All optional — `severity`, `alertType`, `status`, `accountId`, `from`, `to`

### Get alert detail

```
GET /alerts/:id
```

- **Auth**: Bearer JWT

### Acknowledge alert

```
PATCH /alerts/:id/acknowledge
```

- **Auth**: Bearer JWT, minimum role `MANAGER`
- Sets `acknowledgedBy` to the authenticated user's email and `acknowledgedAt` to now

### Bulk acknowledge

```
PATCH /alerts/acknowledge
Body: { "ids": [1, 2, 3] }
```

- **Auth**: Bearer JWT, minimum role `MANAGER`
- Returns `{ "updated": 3 }`

### Metric history (tendency chart data)

```
GET /alerts/:id/metric-history
```

- **Auth**: Bearer JWT
- Returns hourly metric data from -26h to +6h around the alert's `detectedAt`
- Response includes `detectedAt` ISO timestamp for frontend marker placement

### Trigger detection (cron)

```
POST /internal/cron/detect-anomalies?referenceTime=2025-02-17T18:30:00&dryRun=true
X-Cron-Secret: <secret>
```

- **Auth**: `X-Cron-Secret` header only (no JWT)
- See [Trigger Mechanism](#trigger-mechanism) for details

## Frontend

### Alerts page (`/alerts`)

- Paginated table with severity badges (amber for warning, red for critical)
- Status badges: red (active), blue (acknowledged), green (resolved)
- Filterable by severity, status, and alert type
- Acknowledge button for active alerts (visible to MANAGER role and above)
- Auto-refreshes every 60 seconds

### Alert detail panel

- Expandable row showing alert details, timeline, and tendency chart
- Timeline shows detected → acknowledged → resolved timestamps with duration
- Tendency chart with -26h/+6h window, red marker at detection time, gray marker at same hour yesterday
- Link to pool report page for the affected pool

### Dashboard banner

- Shows count of active alerts
- Red background when >= 5 active alerts, amber when < 5, green checkmark when none
- Links to the full alerts page

## Notification Channels

**Currently implemented**: UI only (dashboard banner + alerts page with 60s auto-refresh).

**Not yet implemented**: Email, Slack, SMS, or webhook notifications.

## Database Schema

**Table**: `retention_alerts` (PostgreSQL)

| Column             | Type         | Description                                                                                     |
| ------------------ | ------------ | ----------------------------------------------------------------------------------------------- |
| `id`               | bigint PK    | Auto-incremented                                                                                |
| `account_id`       | integer      | Account that owns the pool                                                                      |
| `alert_type`       | varchar(50)  | `bounce_spike`, `deferred_spike`, `volume_drop`, `volume_spike`, `spam_spike`, `block_detected` |
| `severity`         | varchar(20)  | `warning` or `critical`                                                                         |
| `title`            | varchar(255) | Human-readable summary                                                                          |
| `description`      | text         | Details with UTC hour label, current vs baseline values, z-score                                |
| `metric_name`      | varchar(100) | Which metric triggered it (`bounced`, `deferred`, `total_events`, `spam_rate`)                  |
| `current_value`    | real         | The value that triggered the alert                                                              |
| `baseline_value`   | real         | The baseline median                                                                             |
| `threshold_pct`    | real         | Reserved for future use                                                                         |
| `pool`             | varchar(255) | Email sending pool name                                                                         |
| `provider_account` | varchar(255) | Provider account identifier                                                                     |
| `detected_at`      | timestamptz  | When the anomaly was first detected                                                             |
| `resolved_at`      | timestamptz  | When auto-resolved (null = still active)                                                        |
| `acknowledged_by`  | varchar(255) | Email of user who acknowledged                                                                  |
| `acknowledged_at`  | timestamptz  | When acknowledged                                                                               |
| `metadata`         | jsonb        | Contains `zScore`, `spread`, `dataPoints`                                                       |
| `created_at`       | timestamptz  | Row creation timestamp                                                                          |

**Indexes**:

- `idx_ra_active` on `resolved_at` — fast lookup of active alerts
- `idx_ra_detected` on `detected_at` — ordering by detection time
- `idx_ra_account` on `(account_id, detected_at)` — per-account queries

## Data Source

All metrics come from ClickHouse table `tb_email_hourly_stats`, which is a pre-aggregated `SummingMergeTree` populated by a materialized view (`mv_email_hourly`) from the raw `events_logs_v2` table. Queries use `sum()` to handle potentially unmerged parts transparently.

Granularity: one row per `(hour, account_id, pool, provider_account)` with columns for `bounced`, `deferred`, `delivered`, `spam_reported`, `total_events`, and others.

Baseline queries use `quantiles(0.25, 0.5, 0.75)` aggregation functions to compute median and IQR in a single pass, grouped by `(account_id, pool, provider_account)`.

## Configuration

| Env Variable          | Required | Description                                                |
| --------------------- | -------- | ---------------------------------------------------------- |
| `CRON_SECRET`         | Yes      | Secret for the `X-Cron-Secret` header on the cron endpoint |
| `CLICKHOUSE_HOST`     | Yes      | ClickHouse Cloud connection URL                            |
| `CLICKHOUSE_DATABASE` | Yes      | ClickHouse database name (typically `BMS`)                 |
| `CLICKHOUSE_USERNAME` | Yes      | ClickHouse credentials                                     |
| `CLICKHOUSE_PASSWORD` | Yes      | ClickHouse credentials                                     |

## Key Files

| File                                                          | Purpose                                                        |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| `packages/shared/src/thresholds.ts`                           | `ALERT_THRESHOLDS_V2`, `getSeverityV2()`, `computeZScore()`    |
| `packages/shared/src/types.ts`                                | `StatisticalBaseline`, `AlertType`, `AlertSeverity` interfaces |
| `apps/backoffice-api/src/modules/alerts/alerts.service.ts`    | Detection loops, ClickHouse queries, auto-resolution           |
| `apps/backoffice-api/src/modules/alerts/alerts.controller.ts` | REST API endpoints                                             |
| `apps/frontend/src/features/alerts/`                          | Frontend components, hooks, API client                         |
