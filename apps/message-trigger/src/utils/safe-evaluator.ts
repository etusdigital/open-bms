/**
 * Deterministic evaluator for conditional-step predicates, replacing the
 * legacy `eval()` over operator-controlled strings (see EVO-1193 / H2).
 */

export type AtomOp = 'and' | 'or';

export interface ConditionAtom {
  op?: AtomOp;
  value: boolean;
}

export type ComparisonOperator = '==' | '!=' | '<' | '>' | '<=' | '>=' | 'iLike';

const PROTOTYPE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Combine atoms left-to-right respecting standard precedence (`&&` > `||`).
 * The first atom is treated as the initial AND group.
 */
export function evaluateAtoms(atoms: ConditionAtom[]): boolean {
  if (atoms.length === 0) return true;
  let orResult = false;
  let andGroup = true;
  let firstInGroup = true;
  for (const atom of atoms) {
    if (atom.op === 'or') {
      orResult = orResult || andGroup;
      andGroup = atom.value;
      firstInGroup = false;
    } else {
      // 'and' or undefined (first atom): chain into current AND group
      andGroup = firstInGroup ? atom.value : andGroup && atom.value;
      firstInGroup = false;
    }
  }
  return orResult || andGroup;
}

export function applyComparison(left: unknown, op: ComparisonOperator | string, right: unknown): boolean {
  switch (op) {
    case '=':
    case '==':
      return (left as any) == (right as any);
    case '!=':
      return (left as any) != (right as any);
    case '<':
      return (left as any) < (right as any);
    case '>':
      return (left as any) > (right as any);
    case '<=':
      return (left as any) <= (right as any);
    case '>=':
      return (left as any) >= (right as any);
    case 'iLike':
      // Preserves the legacy eval-based behavior: case-sensitive substring match.
      // The "iLike" name implies case-insensitivity, but the prior implementation
      // used String.prototype.includes without normalization.
      return typeof left === 'string' && typeof right === 'string' && left.includes(right);
    default:
      throw new Error(`Unsupported comparison operator: ${op}`);
  }
}

/**
 * Safe property lookup that rejects prototype-pollution paths. Used to
 * resolve dot-notation paths from operator-controlled strings.
 */
export function safeGetPath(root: unknown, path: string): unknown {
  if (typeof path !== 'string' || path.length === 0) return undefined;
  let current: any = root;
  for (const key of path.split('.')) {
    if (current === null || current === undefined) return undefined;
    if (PROTOTYPE_KEYS.has(key)) return undefined;
    if (typeof current !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, key)) return undefined;
    current = current[key];
  }
  return current;
}

export function safeOwnProp(obj: unknown, key: string): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') return undefined;
  if (typeof key !== 'string' || PROTOTYPE_KEYS.has(key)) return undefined;
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return undefined;
  return (obj as any)[key];
}

export function hasSafeOwnProp(obj: unknown, key: string): boolean {
  if (obj === null || obj === undefined || typeof obj !== 'object') return false;
  if (typeof key !== 'string' || PROTOTYPE_KEYS.has(key)) return false;
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/** Operators allowed for the ClickHouse custom-event time filter. */
export const ALLOWED_CLICKHOUSE_OPERATORS = new Set(['=', '!=', '<', '>', '<=', '>=']);

export function assertAllowedClickhouseOperator(op: unknown): string {
  if (typeof op !== 'string' || !ALLOWED_CLICKHOUSE_OPERATORS.has(op)) {
    throw new Error(`Disallowed ClickHouse operator: ${String(op)}`);
  }
  return op;
}

/**
 * Accepts `YYYY-MM-DD` or full ISO 8601 datetime (`YYYY-MM-DDTHH:MM:SS[.sss][Z|±HH:MM]`
 * or space-separated variant). Legacy producers historically interpolated either
 * shape into the query, so the validator preserves that surface area while still
 * rejecting injection payloads (anything with quotes/semicolons/spaces in the wrong place).
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

export function assertIsoDate(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) {
    throw new Error(`Invalid date for ${fieldName}: ${String(value)}`);
  }
  return value;
}

export function assertSafeKey(key: unknown, fieldName: string): string {
  if (typeof key !== 'string' || key.length === 0 || PROTOTYPE_KEYS.has(key)) {
    throw new Error(`Unsafe key for ${fieldName}: ${String(key)}`);
  }
  return key;
}
