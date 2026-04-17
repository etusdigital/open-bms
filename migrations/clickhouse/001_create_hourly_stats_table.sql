-- Step 1: Create the target table for hourly aggregated stats.
-- Run this BEFORE the backfill script. Do NOT create the MV yet.

CREATE TABLE BMS.tb_email_hourly_stats (
  hour DateTime,
  account_id UInt32,
  pool String,
  provider_account String,
  delivered UInt64,
  bounced UInt64,
  deferred UInt64,
  dropped UInt64,
  spam_reported UInt64,
  opened UInt64,
  clicked UInt64,
  unsubscribed UInt64,
  total_events UInt64
)
ENGINE = SummingMergeTree()
ORDER BY (account_id, hour, pool, provider_account)
PARTITION BY toYYYYMM(hour);
