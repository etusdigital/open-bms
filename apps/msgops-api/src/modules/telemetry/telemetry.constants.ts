export const TELEMETRY_STATE_KEY = 'telemetry_state';

export const DEFAULT_ENDPOINT = 'https://telemetry.etus.com.br';

export const PRODUCT_NAME = 'open-bms';

// 24h
export const HEARTBEAT_PERIOD_MS = 24 * 60 * 60 * 1000;

// ±1h jitter
export const HEARTBEAT_JITTER_MS = 60 * 60 * 1000;

export interface TelemetryStateRecord {
  account_owner_email?: string | null;
  opted_in?: boolean | null;
  install_emitted_at?: string | null;
  last_heartbeat_at?: string | null;
  last_heartbeat_status?: 'ok' | 'error' | null;
}
