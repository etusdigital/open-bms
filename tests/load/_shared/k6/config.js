// Shared k6 config. Each test imports `stages` and `thresholds` and overrides
// PROFILE via env: PROFILE=smoke|1k|10k|100k|1M. Stages climb in order so the
// same script reuses the harness across bateria EVO-1442. Case-insensitive
// match — `1m` is also accepted for ergonomics but normalized to `1M` to
// avoid confusion with k6's `1m` duration literal.

const PROFILES = {
  smoke: [
    { duration: '10s', target: 1 },
    { duration: '20s', target: 5 },
    { duration: '10s', target: 0 },
  ],
  '1k': [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  '10k': [
    { duration: '1m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '1m', target: 0 },
  ],
  '100k': [
    { duration: '2m', target: 500 },
    { duration: '15m', target: 500 },
    { duration: '2m', target: 0 },
  ],
  '1M': [
    { duration: '5m', target: 1000 },
    { duration: '45m', target: 1000 },
    { duration: '5m', target: 0 },
  ],
};

const rawProfile = __ENV.PROFILE || 'smoke';
const profile = rawProfile === '1m' || rawProfile === '1M' ? '1M' : rawProfile.toLowerCase();
if (!PROFILES[profile]) {
  throw new Error(`Unknown PROFILE=${profile}. Valid: ${Object.keys(PROFILES).join(', ')}`);
}

export const stages = PROFILES[profile];

// p95 > 5s = fail, error rate > 1% = fail (per EVO-1443 AC).
export const thresholds = {
  http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: false }],
  http_req_duration: [{ threshold: 'p(95)<5000', abortOnFail: false }],
};

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:6001';
export const EVENT_RECEIVER_URL = __ENV.EVENT_RECEIVER_URL || 'http://localhost:4011';
export const INTERNAL_AUTH_TOKEN =
  __ENV.INTERNAL_AUTH_TOKEN || 'INSECURE_DEV_ONLY_internal-token-do-not-use-in-prod';
export const PROFILE = profile;
