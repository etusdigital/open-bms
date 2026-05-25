// EVO-1027 — k6 trigger for a single bulk-send level.
//
// Fires N triggers against campaign-packer/create-contacts-send/<id> so p95 is
// a real distribution, not a single sample. Drain wait + queue/container
// metrics are handled by run.sh's polling + the _shared/metrics sidecar.
//
// Each iteration triggers the SAME campaign. Safety:
//   - INSERT INTO campaigns_contacts uses ON CONFLICT (campaign_id, contact_id)
//     DO NOTHING → idempotent at the row level.
//   - createBatches sets a Redis guard `campaign:<id>` with EX=60s (when
//     spreadSending=0) → subsequent packer jobs become no-ops, so the
//     downstream pipeline (send-email) is exercised only by the first trigger.
//   - At very high volumes, if 10 iterations span >60s wall-clock the guard
//     expires and you'll re-fire send-email. Default ITERATIONS=10 is safe up
//     to ~250k contacts; drop to 1 for 500k+/1M runs.
//
// Invoked from run.sh via `docker run --network <bms-net> grafana/k6` so it
// can reach `http://campaign-packer:3000` directly (no host port mapping
// needed on the user's compose).
//
// Env:
//   CAMPAIGN_ID         (required)
//   EXPECTED_CONTACTS   (informational, logged in summary)
//   PACKER_BASE_URL     default http://campaign-packer:3000 (in-network)
//   ITERATIONS          default 10 (override to 1 for cheap smoke runs)

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const PACKER_BASE_URL = __ENV.PACKER_BASE_URL || 'http://campaign-packer:3000';
const CAMPAIGN_ID = __ENV.CAMPAIGN_ID;
const EXPECTED_CONTACTS = Number(__ENV.EXPECTED_CONTACTS || 0);
const ITERATIONS = Number(__ENV.ITERATIONS || 10);
// p95 ceiling configurável — default 5s do critério EVO-1027. Override pra
// continuar a escada quando sabemos que vai estourar (250k+ staging, 100k+ local).
const P95_CEILING_MS = Number(__ENV.P95_CEILING_MS || 5000);

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
      iterations: ITERATIONS,
      // Generous ceiling: 1M contacts × ~25s per insert × 10 = ~250s.
      maxDuration: '10m',
    },
  },
  thresholds: {
    // p95 ceiling do trigger — configurável via P95_CEILING_MS env.
    trigger_latency_ms: [`p(95)<${P95_CEILING_MS}`],
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
