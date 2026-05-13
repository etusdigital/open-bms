/**
 * Deterministic ContactBatch generator for stress testing POST /contacts/import.
 *
 * Mirrors the shape consumed by apps/msgops-api/src/modules/contacts/interfaces.ts:11-16
 * (`ContactBatch`). We re-declare the shape locally to keep the tool decoupled from the
 * workspace TS path — this script must run standalone.
 */

export type HeaderType = 'contacts' | 'customField' | 'ignore';

/**
 * NOTE: `apps/msgops-api/src/modules/contacts/interfaces.ts:11-16` declares
 * `contacts: Array<string>` (1-D), but the runtime path
 * (`contacts.service.ts:835`, `row.forEach(...)`) requires a 2-D array of
 * cells. We send the 2-D shape that the service actually consumes. If the
 * declared interface is ever tightened to match the type signature literally,
 * this generator must be updated (F15).
 */
export interface ContactBatch {
  contacts: string[][];
  headers: Record<string, { type: HeaderType; value: string }>;
  tags: string[];
  actions: string[];
}

/**
 * mulberry32 — small, fast PRNG with 32-bit state. Same seed → same sequence.
 * Reference: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Quinn',
  'Avery', 'Parker', 'Drew', 'Hayden', 'Reese', 'Skyler', 'Rowan', 'Sage',
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Rocha',
  'Almeida', 'Carvalho', 'Gomes', 'Ribeiro', 'Martins', 'Araujo', 'Barbosa', 'Cardoso',
];

const SOURCES = ['organic', 'paid-ads', 'referral', 'event', 'partner', 'newsletter'];

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function phone(rng: () => number): string {
  let digits = '';
  for (let i = 0; i < 11; i++) digits += Math.floor(rng() * 10).toString();
  return `+55${digits}`;
}

/**
 * Generates a deterministic `ContactBatch` with `n` rows.
 *
 * Header layout (matches `Record<string, { type, value }>` expected by the API):
 *   "0" → email          (contacts)
 *   "1" → firstName      (contacts)
 *   "2" → lastName       (contacts)
 *   "3" → phone          (contacts)
 *   "4" → source         (customField)
 *
 * `tags` carries a single discriminator (`stress-test`) so the operator can
 * cleanup post-run. `actions` stays empty — the API tolerates it.
 *
 * Determinism guarantee (AC5): `generatePayload(n, seed)` returns byte-identical
 * JSON across processes/hosts for the same (n, seed) pair.
 */
export function generatePayload(n: number, seed: number): ContactBatch {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`generatePayload: n must be a non-negative integer (got ${n})`);
  }
  if (!Number.isInteger(seed)) {
    throw new Error(`generatePayload: seed must be an integer (got ${seed})`);
  }

  const rng = mulberry32(seed);
  const contacts: string[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    contacts[i] = [
      `stress-${seed}-${i}@example.test`,
      pick(FIRST_NAMES, rng),
      pick(LAST_NAMES, rng),
      phone(rng),
      pick(SOURCES, rng),
    ];
  }

  return {
    contacts,
    headers: {
      '0': { type: 'contacts', value: 'email' },
      '1': { type: 'contacts', value: 'firstName' },
      '2': { type: 'contacts', value: 'lastName' },
      '3': { type: 'contacts', value: 'phone' },
      '4': { type: 'customField', value: 'source' },
    },
    tags: ['stress-test'],
    actions: [],
  };
}
