// k6 mock: fires synthetic SendGrid event-webhook batches at event-receiver.
//
// Real-world routing is SendGrid → event-receiver (host port 4011) → AMQP
// → event-process. The actual /internal/event/sendgrid endpoint inside
// event-process isn't exposed to the host, so we drive the pipeline from
// its public ingress — same path production traffic takes.
//
// Wire format mirrors what apps/sendgrid-mock/main.go fires when msgops-api
// registers SendGrid: POST to `${SENDGRID_WEBHOOK_URL_BASE}` which compose
// pins to `http://event-receiver:3011/bms/events?platform=sendgrid&account=<id>`.
// event-receiver harvests `platform` + `account` from the querystring and
// stores `request.body` in `message.payload`. The downstream consumer reads
// `events.payload: SendgridPayload[]` and `events.account: string`, so the
// HTTP body MUST be the raw event array — no envelope.
//
// Auth: event-receiver is unauthenticated at the network edge (it's the
// public webhook ingress). The shared-secret gate (`x-internal-token`) sits
// between the AMQP consumer and the internal /internal/event/sendgrid bridge
// — see packages/messaging/src/http-bridge.ts. We don't need it on the
// receiver request. HMAC mentioned in the EVO-1443 spec only applies to
// providers whose real SaaS APIs require it (Mailersend / Resend Svix /
// Mandrill).
//
//   k6 run \
//     -e DELIVERIES=1000 -e BATCH=50 \
//     tests/load/_shared/mock-webhook/sendgrid-events.js
//
// Tunables:
//   DELIVERIES    total `delivered` events to emit (default 1000).
//                 EVENTS is accepted as a back-compat alias.
//   BATCH         events per webhook POST (default 50; real SendGrid batches up to ~1k)
//   ACCOUNT_ID    target account_id seeded in PG (default 1 = bootstrap admin)
//   RATIO_OPEN    open/delivered ratio (default 0.4)
//   RATIO_CLICK   click/delivered ratio (default 0.05)
//
// Total events fired ≈ DELIVERIES × (1 + RATIO_OPEN + RATIO_CLICK × RATIO_OPEN).

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { EVENT_RECEIVER_URL } from '../k6/config.js';

const TOTAL = Number(__ENV.DELIVERIES || __ENV.EVENTS || 1000);
const BATCH = Number(__ENV.BATCH || 50);
const ACCOUNT_ID = String(__ENV.ACCOUNT_ID || '1');
const RATIO_OPEN = Number(__ENV.RATIO_OPEN || 0.4);
const RATIO_CLICK = Number(__ENV.RATIO_CLICK || 0.05);

const TOTAL_BATCHES = Math.ceil(TOTAL / BATCH);

export const options = {
  scenarios: {
    sendgrid: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: TOTAL_BATCHES,
      maxDuration: '10m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<5000'],
  },
};

// Pre-generated batches are stored once and shared across VUs (k6 dedup).
const batches = new SharedArray('sendgrid-batches', function () {
  const out = [];
  for (let b = 0; b < TOTAL_BATCHES; b++) {
    out.push(buildBatch(b * BATCH, Math.min(BATCH, TOTAL - b * BATCH)));
  }
  return out;
});

function buildBatch(offset, size) {
  // Each entry is a SendgridPayload — the array IS the request body, matching
  // SendGrid's real Event Webhook format.
  const events = [];
  for (let i = 0; i < size; i++) {
    const id = offset + i;
    const email = `load-${id}@example.com`;
    const messageId = `msg-${id}.filterdrecv-${Date.now()}`;
    const contactId = String(id + 1);
    events.push({
      email: email,
      timestamp: Math.floor(Date.now() / 1000),
      event: 'delivered',
      category: ['load-evo-1443'],
      sg_event_id: `evt-delivered-${id}-${Date.now()}`,
      sg_message_id: messageId,
      response: '250 OK',
      contactId: contactId,
    });
    if (Math.random() < RATIO_OPEN) {
      events.push({
        email: email,
        timestamp: Math.floor(Date.now() / 1000),
        event: 'open',
        category: ['load-evo-1443'],
        sg_event_id: `evt-open-${id}-${Date.now()}`,
        sg_message_id: messageId,
        contactId: contactId,
      });
    }
    if (Math.random() < RATIO_CLICK) {
      events.push({
        email: email,
        timestamp: Math.floor(Date.now() / 1000),
        event: 'click',
        category: ['load-evo-1443'],
        sg_event_id: `evt-click-${id}-${Date.now()}`,
        sg_message_id: messageId,
        contactId: contactId,
        url: 'https://example.com/load-test',
      });
    }
  }
  return events;
}

const POST_URL = `${EVENT_RECEIVER_URL}/bms/events?platform=sendgrid&account=${encodeURIComponent(ACCOUNT_ID)}`;

export default function () {
  const idx = __ITER % batches.length;
  const body = JSON.stringify(batches[idx]);
  const res = http.post(POST_URL, body, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'sendgrid-webhook' },
  });
  check(res, { 'webhook accepted': (r) => r.status >= 200 && r.status < 300 });
}
