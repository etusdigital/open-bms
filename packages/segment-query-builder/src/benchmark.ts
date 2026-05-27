// Benchmark for AC2: `generate()` on a representative-sized segment in
// <50ms p95 over 1000 iterations.
//
// Run: pnpm --filter @msgops/segment-query-builder build && \
//      node packages/segment-query-builder/dist/benchmark.js

import { generateForSegment } from './index';

// 8-step segment touching all branches that produce ClickHouse subqueries
// (page_view, custom_event, automation_state, interation with custom_times)
// — representative of a moderately complex production segment.
const segmentDto = {
  steps: [
    [
      { type: 'conditionalCard', value: '' },
      { type: 'interation', event_type: 'email', event: 'last_click_date', message: 'any', conditional_interation: 'yes', time: '30' },
      { type: 'interation', event_type: 'page_view', page_view_filter: 'iLike', page_view_value: 'pricing', conditional_interation: 'yes', time: '7', custom_times_value: 3, conditional_times_value: '>=' },
      { type: 'custom_field', custom_field_id: 42, custom_field_value: 'gold', conditional_custom_field: '=', custom_field_type: 'text' },
      { type: 'user_field', user_field_key: 'created_at_date', conditional_user_field: '-', user_field_value: '90' },
      { type: 'custom_event', event: { name: 'purchase' }, conditional_event_type: 'IN', conditional_event_filter: '>=', time: '30', custom_times_value: 1, conditional_times_value: '>=', properties: [{ property: 'category', value: 'premium' }] },
      { type: 'automation_state', event: 'completed', time: 7, automation: { id: 17 }, custom_times_value: 1, conditional_times_value: '>=' },
      { type: 'tag', tag_id: 99, conditional_tag: 'in' },
    ],
  ],
  addBounced: false,
  addInvalid: false,
  addUnsubscribed: false,
  contactsLimit: 100000,
};

const tag = { id: 12345, accountId: 1 };
const timeZone = 'America/Sao_Paulo';
const ITERATIONS = 1000;

// Warmup
for (let i = 0; i < 100; i++) generateForSegment(tag, segmentDto, timeZone);

const samples: number[] = [];
for (let i = 0; i < ITERATIONS; i++) {
  const start = process.hrtime.bigint();
  generateForSegment(tag, segmentDto, timeZone);
  const end = process.hrtime.bigint();
  samples.push(Number(end - start) / 1_000_000); // ns -> ms
}

samples.sort((a, b) => a - b);
const p50 = samples[Math.floor(ITERATIONS * 0.5)];
const p95 = samples[Math.floor(ITERATIONS * 0.95)];
const p99 = samples[Math.floor(ITERATIONS * 0.99)];
const mean = samples.reduce((s, v) => s + v, 0) / ITERATIONS;

console.log(`generateForSegment over ${ITERATIONS} iterations (V1, 8-step segment):`);
console.log(`  mean: ${mean.toFixed(3)}ms`);
console.log(`  p50:  ${p50.toFixed(3)}ms`);
console.log(`  p95:  ${p95.toFixed(3)}ms`);
console.log(`  p99:  ${p99.toFixed(3)}ms`);
console.log(`  AC2 target: p95 < 50ms — ${p95 < 50 ? 'PASS' : 'FAIL'}`);
