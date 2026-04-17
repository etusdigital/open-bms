-- Global Monitor Targets: cross-account monitoring configs
-- A target defines what to monitor (e.g., a sender email) across all accounts.
-- The alert system resolves targets to pool filters at detection time.

CREATE TABLE global_monitor_targets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  target_type VARCHAR(20) NOT NULL,       -- 'sender' | 'ip' (future)
  target_value VARCHAR(255) NOT NULL,     -- sender email or IP address
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_gmt_type_value ON global_monitor_targets(target_type, target_value);

-- Link alerts to monitor targets for global (cross-account) alerts
ALTER TABLE retention_alerts ADD COLUMN monitor_target_id INTEGER REFERENCES global_monitor_targets(id);
CREATE INDEX idx_ra_monitor_target ON retention_alerts(monitor_target_id) WHERE monitor_target_id IS NOT NULL;
