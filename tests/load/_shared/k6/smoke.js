// Smoke test — proves the harness compiles, auth works against the local
// stack, and CSV output lands where the report script expects it.
//
//   k6 run --out csv=tests/load/_shared/k6/out/smoke.csv tests/load/_shared/k6/smoke.js
//
// Requires AUTH_PROVIDER=local with BOOTSTRAP_ADMIN_* set (the default
// docker-compose seeds admin@example.com / ChangeMe123!).

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, thresholds } from './config.js';
import { login, authHeaders } from './auth.js';
import { businessLatency, businessErrors } from './metrics.js';

export const options = {
  stages: [
    { duration: '5s', target: 1 },
    { duration: '10s', target: 2 },
    { duration: '5s', target: 0 },
  ],
  thresholds,
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  const res = http.get(`${BASE_URL}/api-docs-json`, {
    headers: authHeaders(data.token),
    tags: { endpoint: 'smoke' },
  });
  businessLatency.add(res.timings.duration);
  const ok = check(res, { 'smoke 200': (r) => r.status === 200 });
  if (!ok) businessErrors.add(1);
  sleep(1);
}
