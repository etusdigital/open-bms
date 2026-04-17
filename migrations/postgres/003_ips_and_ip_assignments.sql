-- IPs table
CREATE TABLE IF NOT EXISTS ips (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  acquired_at DATE NOT NULL,
  decommissioned_at DATE NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ips_ip_address ON ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_ips_provider ON ips(provider);

-- IP assignments table
CREATE TABLE IF NOT EXISTS ip_assignments (
  id SERIAL PRIMARY KEY,
  ip_id INTEGER NOT NULL REFERENCES ips(id) ON DELETE CASCADE,
  pool_id INTEGER NULL,
  pool_name VARCHAR(255) NOT NULL,
  account_id INTEGER NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by VARCHAR(255) NULL,
  removed_at TIMESTAMPTZ NULL,
  removed_by VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_assignments_ip_id ON ip_assignments(ip_id);
CREATE INDEX IF NOT EXISTS idx_ip_assignments_pool_id ON ip_assignments(pool_id);
CREATE INDEX IF NOT EXISTS idx_ip_assignments_account_id ON ip_assignments(account_id);
CREATE INDEX IF NOT EXISTS idx_ip_assignments_active ON ip_assignments(ip_id) WHERE removed_at IS NULL;
