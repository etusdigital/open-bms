-- ============================================================
-- Migration 010: routing_rules
-- ============================================================
-- Uma linha por account — upsert ao salvar, substituição total do config.
-- O campo config JSONB armazena { generalRule[], exceptions[], defaultConfig }.

CREATE TABLE IF NOT EXISTS routing_rules (
  id          SERIAL PRIMARY KEY,
  account_id  INTEGER NOT NULL,
  config      JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_routing_rules_account
    FOREIGN KEY (account_id) REFERENCES accounts(id),
  CONSTRAINT uq_routing_rules_account
    UNIQUE (account_id)
);

CREATE INDEX IF NOT EXISTS idx_routing_rules_account ON routing_rules(account_id);
