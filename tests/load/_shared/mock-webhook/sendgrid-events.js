// k6 mock: fires synthetic SendGrid event-webhook batches at event-receiver.
//
// Real-world routing is SendGrid → event-receiver (host port 4011) → AMQP
// → event-process. The actual /sendgrid endpoint inside event-process isn't
// exposed to the host, so we drive the pipeline from its public ingress —
// same path production traffic takes.
//
// Event-receiver auth: header `x-internal-token` (INTERNAL_AUTH_TOKEN). The
// EVO-1443 spec mentions HMAC, but this stack uses shared-secret bearer auth
// across all webhook providers (see apps/event-process/src/app.controller.ts);
// HMAC only applies to providers whose real SaaS APIs require it (Mailersend,
// Resend Svix, Mandrill).
//
//   k6 run \
//     -e EVENTS=1000 -e BATCH=50 \
//     tests/load/_shared/mock-webhook/sendgrid-events.js
//
// Tunables:
//   EVENTS        total events to deliver (default 1000)
//   BATCH         events per webhook POST (default 50; SendGrid batches up to ~1k)
//   ACCOUNT_ID    target account_id seeded in PG (default 1 = bootstrap admin)
//   RATIO_OPEN    open/delivered ratio (default 0.4)
//   RATIO_CLICK   click/delivered ratio (default 0.05)

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { EVENT_RECEIVER_URL, INTERNAL_AUTH_TOKEN } from '../k6/config.js';

const TOTAL = Number(__ENV.EVENTS || 1000);
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
  return {
    payload: events,
    platform: 'EMAIL',
    account: ACCOUNT_ID,
  };
}

export default function () {
  const idx = __ITER % batches.length;
  const body = JSON.stringify(batches[idx]);
  const res = http.post(`${EVENT_RECEIVER_URL}/bms/events?platform=sendgrid`, body, {
    headers: {
      'Content-Type': 'application/json',
      'x-internal-token': INTERNAL_AUTH_TOKEN,
    },
    tags: { endpoint: 'sendgrid-webhook' },
  });
  check(res, { 'webhook accepted': (r) => r.status >= 200 && r.status < 300 });
}
