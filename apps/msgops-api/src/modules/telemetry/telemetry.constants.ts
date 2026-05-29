export const TELEMETRY_STATE_KEY = 'telemetry_state';

// @etus/telemetry-sdk ≥0.1.1 ships no default endpoint (init returns
// reason='no_endpoint' → no-op when none is given), so BMS supplies its own.
// Overridable via ETUS_TELEMETRY_ENDPOINT.
export const DEFAULT_ENDPOINT = 'https://otw.etus.dev';

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
