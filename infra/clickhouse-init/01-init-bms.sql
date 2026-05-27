CREATE DATABASE IF NOT EXISTS BMS;

CREATE TABLE IF NOT EXISTS BMS.events_logs_v2
(
    `time` DateTime64(3, 'UTC'),
    `date` Date,
    `time_date` Date DEFAULT toDate(time),
    `account_id` UInt32,
    `message_type` LowCardinality(String) DEFAULT '',
    `event` String,
    `contact_id` Int32,
    `automation_id` Int32,
    `campaign_id` Int32,
    `message_id` Int32,
    `email` String,
    `utm_campaign` String,
    `provider` String,
    `is_test_ab` Bool,
    `reason` String,
    `url` String,
    `ip` IPv6,
    `events_logs_id` UInt64,
    `uuid` String,
    `event_id` Int32,
    `user_agent` String,
    `is_mobile` Bool,
    `os` String,
    `os_version` String,
    `browser` String,
    `pool` String,
    `link_position` Int32,
    `value` String,
    `value_number` Float64,
    `value_time` DateTime64(3, 'UTC'),
    `properties` JSON,
    `country` String,
    `region` String,
    `seconds_since_sent` Int32,
    `provider_account` String,
    `city` String,
    `delivered_id` String,
    `event_log_id` String
)
ENGINE = MergeTree
PARTITION BY (account_id, toYYYYMM(time_date))
ORDER BY (account_id, message_type, time_date, event)
TTL time_date + toIntervalDay(180)
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS BMS.tb_email_hourly_stats (
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

CREATE MATERIALIZED VIEW IF NOT EXISTS BMS.mv_email_hourly
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
