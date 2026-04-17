-- Add is_super_admin flag to existing users table for retention backoffice access control
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;
