# Per-IP Delivery Analysis

**Date**: 2026-02-17

## Current Implementation: On-Demand Self-Join

The IP report page (`/reports/ips`) is available in the UI but queries `events_logs_v2` directly via a self-join instead of a pre-aggregated materialized view. This is intentionally slower than other report pages but avoids the infrastructure cost of real-time IP-level MVs.

**How it works**: Delivered events already carry the `ip` field. For other events (bounces, opens, clicks), the backend joins on `delivered_id` to resolve which IP sent that email.

**Trade-offs**:

- Requires a date range to be selected before querying (no auto-load)
- Slower than MV-backed reports (seconds vs milliseconds)
- No IP-level alerting or monitoring (would require pre-aggregation)
- Works well for bounded time ranges (7/30 days)

## Why Not Materialized Views

We evaluated pre-aggregating IP stats via ClickHouse MVs but deferred due to:

### Join Engine Memory Cost

The design requires a `Join(ANY, LEFT, delivered_id)` engine table to map `delivered_id -> sending_ip`. This table loads entirely into RAM:

- ~1.43 billion delivered events with valid IP data
- Estimated 150-300 GiB RAM consumption
- Must be rebuilt on ClickHouse restart

### Write Amplification

- ~28% of all events (17-19M/day) trigger MV updates
- Each qualifying event causes two writes: main table + MV
- Adds real cost on ClickHouse Cloud billing

### Backfill Risk

- Populating 1.43B rows into a Join engine table is operationally risky
- Could impact cluster performance during backfill

## Future: Pre-Aggregated IP Stats

When we need real-time IP monitoring/alerting (e.g., Postmaster integration), revisit with:

### Option A: Scheduled Queries (Preferred)

ClickHouse Cloud supports scheduled queries. Run a nightly job that populates a regular `MergeTree` table with daily IP stats. No RAM-hungry Join engine needed.

```sql
-- Target table (disk-based, not in RAM)
CREATE TABLE retention_daily_stats_by_ip (
  date Date,
  account_id UInt32,
  pool String,
  provider_account String,
  sending_ip String,
  delivered UInt64,
  bounced UInt64,
  deferred UInt64,
  dropped UInt64,
  spam_reported UInt64,
  opened UInt64,
  clicked UInt64,
  total_events UInt64
)
ENGINE = ReplacingMergeTree()
ORDER BY (account_id, date, pool, provider_account, sending_ip)
PARTITION BY toYYYYMM(date);
```

### Option B: Delivered-Only MV (Lightweight)

Only materialize delivered events by IP (no lookup table needed since `delivered` events already carry the IP). Bounce/open attribution stays on-demand.

### Option C: Full MV with ReplacingMergeTree Lookup

If real-time is needed, use `ReplacingMergeTree` instead of `Join` engine for the lookup table. Trade RAM for disk I/O. Note: `joinGet()` only works with Join engine, so MVs would need restructuring.

## Postmaster Integration Notes

When combining with Google Postmaster data:

- Postmaster provides daily domain/IP reputation scores
- Join postmaster reputation with our delivery stats by IP + date
- This enables: "IP X has poor reputation at Gmail AND high bounce rate -> reduce volume"
- Postmaster data is daily, so daily aggregation (Option A) is the natural fit
- The IP report page already provides the UI foundation for this
