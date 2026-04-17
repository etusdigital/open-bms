CREATE TABLE retention_alerts (
  id BIGSERIAL PRIMARY KEY,
  account_id INTEGER,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metric_name VARCHAR(100),
  current_value FLOAT,
  baseline_value FLOAT,
  threshold_pct FLOAT,
  pool VARCHAR(255),
  provider_account VARCHAR(255),
  detected_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ra_active ON retention_alerts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_ra_detected ON retention_alerts(detected_at DESC);
CREATE INDEX idx_ra_account ON retention_alerts(account_id, detected_at DESC);
