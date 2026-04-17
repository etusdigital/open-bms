-- Add usage tracking columns to ips table
ALTER TABLE ips ADD COLUMN IF NOT EXISTS last_30d_delivered INTEGER NULL;
ALTER TABLE ips ADD COLUMN IF NOT EXISTS usage_updated_at TIMESTAMPTZ NULL;
