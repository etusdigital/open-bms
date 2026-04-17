-- Add SendGrid domain authentication columns to pools table
ALTER TABLE pools ADD COLUMN IF NOT EXISTS subuser VARCHAR(255);
ALTER TABLE pools ADD COLUMN IF NOT EXISTS sendgrid_domain_id INTEGER;
ALTER TABLE pools ADD COLUMN IF NOT EXISTS is_sendgrid_authenticated BOOLEAN DEFAULT false;
ALTER TABLE pools ADD COLUMN IF NOT EXISTS sendgrid_dns JSONB;
