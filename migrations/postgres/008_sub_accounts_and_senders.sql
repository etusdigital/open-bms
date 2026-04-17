-- ============================================================
-- Migration 008: sub_accounts e senders
-- ============================================================

-- Tabela sub_accounts
CREATE TABLE IF NOT EXISTS sub_accounts (
  id                  SERIAL PRIMARY KEY,
  account_id          INTEGER NOT NULL,
  name                VARCHAR(255) NOT NULL,
  description         TEXT,
  color               VARCHAR(7),
  type                VARCHAR(20),--todo: add api_key text
  sendgrid_username   VARCHAR(255) UNIQUE NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  CONSTRAINT fk_sub_accounts_account
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_sub_accounts_account ON sub_accounts(account_id);

-- Tabela senders
CREATE TABLE IF NOT EXISTS senders (
  id                      SERIAL PRIMARY KEY,
  sub_account_id          INTEGER NOT NULL,
  name                    VARCHAR(255) NOT NULL,--from_name
  email                   VARCHAR(255) NOT NULL,--from_mail
  reply_to_email          VARCHAR(255),--reply_to_mail
  pool_name               VARCHAR(255) NOT NULL,
  ips                     JSONB DEFAULT '[]',
  rate_limit_per_hour     INTEGER,
  rate_limit_per_day      INTEGER,
  sendgrid_domain_id      INTEGER,
  sendgrid_dns            JSONB,
  is_verified             BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ,
  CONSTRAINT fk_senders_sub_account
    FOREIGN KEY (sub_account_id) REFERENCES sub_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_senders_sub_account ON senders(sub_account_id);
-- Unique somente entre senders não deletados
CREATE UNIQUE INDEX IF NOT EXISTS idx_senders_pool_name_active
  ON senders(pool_name) WHERE deleted_at IS NULL;
