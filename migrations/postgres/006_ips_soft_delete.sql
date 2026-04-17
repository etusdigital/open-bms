-- Add soft delete column to ips table
ALTER TABLE ips ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Change ip_assignments FK from CASCADE to NO ACTION (preserve history)
ALTER TABLE ip_assignments DROP CONSTRAINT IF EXISTS "FK_ip_assignments_ip_id";
ALTER TABLE ip_assignments
  ADD CONSTRAINT "FK_ip_assignments_ip_id"
  FOREIGN KEY (ip_id) REFERENCES ips(id) ON DELETE NO ACTION;
