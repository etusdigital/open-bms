#!/bin/bash
# Wires the analytics pipeline producer (event-process publishing AMQP to
# bms.analytics/event.enriched) into ClickHouse via the RabbitMQ engine.
#
# events_queue is a streaming-engine table backed by RabbitMQ; rows arriving
# on the bound exchange flow through mv_events_to_logs into events_logs_v2,
# which then cascades through the existing mv_email_hourly into
# tb_email_hourly_stats. No application consumer is involved.
#
# Credentials come from env vars so the compose defaults work out of the
# box and self-hosters who change RABBITMQ_DEFAULT_USER/PASS in .env get
# the override applied at first init.
set -euo pipefail

: "${RABBITMQ_HOST_PORT:=rabbitmq:5672}"
: "${RABBITMQ_USER:=guest}"
: "${RABBITMQ_PASSWORD:=guest}"
# ClickHouse creds: the entrypoint exports these to initdb scripts. Defaults
# keep a passwordless setup working; when CLICKHOUSE_PASSWORD is set the bare
# `default` user is no longer accepted, so pass it explicitly.
: "${CLICKHOUSE_USER:=default}"
: "${CLICKHOUSE_PASSWORD:=}"

clickhouse-client --user "${CLICKHOUSE_USER}" --password "${CLICKHOUSE_PASSWORD}" --multiquery <<SQL
CREATE TABLE IF NOT EXISTS BMS.events_queue
(
    \`time\` DateTime64(3, 'UTC'),
    \`date\` Date,
    \`time_date\` Date,
    \`account_id\` UInt32,
    \`message_type\` LowCardinality(String) DEFAULT '',
    \`event\` String,
    \`contact_id\` Int32,
    \`automation_id\` Int32,
    \`campaign_id\` Int32,
    \`message_id\` Int32,
    \`email\` String,
    \`utm_campaign\` String,
    \`provider\` String,
    \`is_test_ab\` Bool,
    \`reason\` String,
    \`url\` String,
    \`ip\` IPv6,
    \`events_logs_id\` UInt64,
    \`uuid\` String,
    \`event_id\` Int32,
    \`user_agent\` String,
    \`is_mobile\` Bool,
    \`os\` String,
    \`os_version\` String,
    \`browser\` String,
    \`pool\` String,
    \`link_position\` Int32,
    \`value\` String,
    \`value_number\` Float64,
    \`value_time\` DateTime64(3, 'UTC'),
    \`properties\` String,
    \`country\` String,
    \`region\` String,
    \`seconds_since_sent\` Int32,
    \`provider_account\` String,
    \`city\` String,
    \`delivered_id\` String,
    \`event_log_id\` String
)
ENGINE = RabbitMQ
SETTINGS
    rabbitmq_host_port = '${RABBITMQ_HOST_PORT}',
    rabbitmq_exchange_name = 'bms.analytics',
    rabbitmq_exchange_type = 'topic',
    rabbitmq_routing_key_list = 'event.enriched',
    rabbitmq_format = 'JSONEachRow',
    rabbitmq_username = '${RABBITMQ_USER}',
    rabbitmq_password = '${RABBITMQ_PASSWORD}',
    rabbitmq_num_consumers = 1;

CREATE MATERIALIZED VIEW IF NOT EXISTS BMS.mv_events_to_logs
TO BMS.events_logs_v2
AS SELECT
    time, date, time_date, account_id, message_type, event,
    contact_id, automation_id, campaign_id, message_id, email,
    utm_campaign, provider, is_test_ab, reason, url, ip,
    events_logs_id, uuid, event_id, user_agent, is_mobile, os,
    os_version, browser, pool, link_position, value, value_number,
    value_time, properties, country, region, seconds_since_sent,
    provider_account, city, delivered_id, event_log_id
FROM BMS.events_queue;
SQL
