# ClickHouse Schema Reference

## events_logs_v2

Raw email/messaging event logs written by `msgops-event-process`. This is the source table for all event-level queries and feeds the `mv_email_hourly` materialized view.

**Database**: `BMS`
**Size**: ~10B rows, 358 GB compressed, 3.17 TB uncompressed
**TTL**: 180 days

```sql
CREATE TABLE BMS.events_logs_v2
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
ENGINE = SharedMergeTree('/clickhouse/tables/{uuid}/{shard}', '{replica}')
PARTITION BY (account_id, toYYYYMM(time_date))
ORDER BY (account_id, message_type, time_date, event)
TTL time + toIntervalDay(180)
SETTINGS index_granularity = 8192
```

### Key columns for queries

| Column | Type | Notes |
|--------|------|-------|
| `time` | DateTime64(3, 'UTC') | Precise event timestamp (ms). Use for exact time filtering. |
| `time_date` | Date | Derived from `time` (UTC). **Must be in WHERE for primary index usage.** |
| `account_id` | UInt32 | Partition key + ORDER BY prefix. Always filter by this. |
| `message_type` | LowCardinality(String) | 2nd in ORDER BY. Filter with `= 'email'` for email events. |
| `event` | String | 4th in ORDER BY. Values: `delivered`, `bounce`, `bounced`, `deferred`, `dropped`, `spamreport`, `open`, `click`, `unsubscribe`, `group_unsubscribe` |
| `delivered_id` | String | Links non-delivery events back to the original delivered event (for IP attribution joins). |

### Query performance rules

1. **Always include `time_date` in WHERE** -- it's the 3rd column in ORDER BY and enables granule skipping. Without it, ClickHouse scans all granules within a monthly partition.

2. **Use +-1 day buffer for timezone safety** -- `time_date` is UTC-based (`toDate(time)`) but user date ranges are in local timezone. Use:
   ```sql
   time_date >= toDate({from:String}) - 1
   time_date <= toDate({to:String}) + 1
   ```
   The precise `time` filter still enforces exact boundaries.

3. **Filter by `account_id`** -- it's the partition key prefix. Without it, all partitions are scanned.

4. **Filter by `message_type`** -- 2nd in ORDER BY, further narrows granule reads.

5. **Avoid wide date ranges for raw event queries** -- each day can have millions of events per account. Default to current day for event detail views.

6. **COUNT queries are expensive** -- `SELECT count()` must scan all matching rows. Run separately from data queries to avoid blocking the UI.

### Partition and index structure

```
PARTITION BY (account_id, toYYYYMM(time_date))
ORDER BY    (account_id, message_type, time_date, event)
```

- **Partitions**: One per account per month. ClickHouse prunes partitions using `account_id` and `toYYYYMM(time_date)`.
- **Primary index**: Within each partition, granules (8192 rows) are indexed by `(account_id, message_type, time_date, event)`. Filtering on these columns in order allows ClickHouse to skip irrelevant granules.

### Relationship to other tables

```
msgops-event-process
      | (writes raw events)
      v
events_logs_v2                    <-- this table
      | (MV reads new inserts)
      v
mv_email_hourly                   (materialized view)
      | (inserts aggregated rows)
      v
tb_email_hourly_stats             (SummingMergeTree, hourly aggregates)
```

## tb_email_hourly_stats

Pre-aggregated hourly email statistics. See `migrations/clickhouse/001_create_hourly_stats_table.sql`.

```sql
ENGINE = SummingMergeTree()
ORDER BY (account_id, hour, pool, provider_account)
PARTITION BY toYYYYMM(hour)
```

Columns: `hour`, `account_id`, `pool`, `provider_account`, `delivered`, `bounced`, `deferred`, `dropped`, `spam_reported`, `opened`, `clicked`, `unsubscribed`, `total_events`.
