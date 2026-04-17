-- Step 4: Create the materialized view AFTER backfill is complete.
--
-- Deployment order:
--   1. Run 001_create_hourly_stats_table.sql (create table)
--   2. Run backfill: pnpm tsx scripts/backfill-hourly-stats.ts
--   3. Stop msgops-event-process
--   4. Run today's backfill: pnpm tsx scripts/backfill-hourly-stats.ts --today
--   5. Run THIS migration (create MV)
--   6. Restart msgops-event-process
--
-- From this point, new inserts into events_logs_v2 are auto-aggregated.

CREATE MATERIALIZED VIEW BMS.mv_email_hourly
TO BMS.tb_email_hourly_stats
AS SELECT
  toStartOfHour(time) AS hour,
  account_id,
  coalesce(pool, '') AS pool,
  coalesce(provider_account, '') AS provider_account,
  countIf(event = 'delivered') AS delivered,
  countIf(event IN ('bounce', 'bounced')) AS bounced,
  countIf(event = 'deferred') AS deferred,
  countIf(event = 'dropped') AS dropped,
  countIf(event = 'spamreport') AS spam_reported,
  countIf(event = 'open') AS opened,
  countIf(event = 'click') AS clicked,
  countIf(event IN ('unsubscribe', 'group_unsubscribe')) AS unsubscribed,
  count() AS total_events
FROM BMS.events_logs_v2
WHERE message_type = 'email'
GROUP BY hour, account_id, pool, provider_account;
