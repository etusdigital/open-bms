// EVO-1027 — k6 trigger for a single bulk-send level.
//
// Single-shot trigger: POST campaign-packer/create-contacts-send/<id> and
// measure that one request's latency. Drain wait + queue/container metrics
// are handled by run.sh's polling + the _shared/metrics sidecar — keeping
// this script narrow makes the latency number clean.
//
// Invoked from run.sh via `docker run --network <bms-net> grafana/k6` so it
// can reach `http://campaign-packer:3000` directly (no host port mapping
// needed on the user's compose).
//
// Env:
//   CAMPAIGN_ID         (required)
//   EXPECTED_CONTACTS   (informational, logged in summary)
//   PACKER_BASE_URL     default http://campaign-packer:3000 (in-network)

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const PACKER_BASE_URL = __ENV.PACKER_BASE_URL || 'http://campaign-packer:3000';
const CAMPAIGN_ID = __ENV.CAMPAIGN_ID;
const EXPECTED_CONTACTS = Number(__ENV.EXPECTED_CONTACTS || 0);

if (!CAMPAIGN_ID) {
  throw new Error('CAMPAIGN_ID env is required');
}

export const triggerLatency = new Trend('trigger_latency_ms', true);
export const triggerErrors = new Counter('trigger_errors');

export const options = {
  scenarios: {
    trigger: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    // Single-shot trigger should be sub-5s even at 1M contacts (packer only
    // enqueues, doesn't enumerate contacts synchronously). If the trigger
    // itself blows past 5s the API is already showing strain.
    trigger_latency_ms: ['p(95)<5000'],
    trigger_errors: ['count==0'],
  },
};

export default function () {
  const url = `${PACKER_BASE_URL}/create-contacts-send/${CAMPAIGN_ID}`;
  const t0 = Date.now();
  const res = http.post(url, '', {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'packer-trigger', campaign: String(CAMPAIGN_ID) },
  });
  const dt = Date.now() - t0;
  triggerLatency.add(dt);

  const ok = check(res, {
    'trigger 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  if (!ok) {
    triggerErrors.add(1);
    console.error(`Trigger failed: status=${res.status} body=${res.body}`);
  } else {
    console.log(`[bulk-send] campaign=${CAMPAIGN_ID} expected=${EXPECTED_CONTACTS} trigger=${dt}ms status=${res.status}`);
  }
}
