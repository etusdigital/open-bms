import { applyComparison, assertAllowedClickhouseOperator, assertIsoDate, evaluateAtoms, hasSafeOwnProp, safeGetPath, safeOwnProp } from './safe-evaluator';

describe('evaluateAtoms', () => {
  it('returns true for empty atom list', () => {
    expect(evaluateAtoms([])).toBe(true);
  });

  it('evaluates a single atom', () => {
    expect(evaluateAtoms([{ value: true }])).toBe(true);
    expect(evaluateAtoms([{ value: false }])).toBe(false);
  });

  it('respects && precedence over ||', () => {
    // T && F || T => false || true => true
    expect(evaluateAtoms([{ value: true }, { op: 'and', value: false }, { op: 'or', value: true }])).toBe(true);
    // T && T || F => true || false => true
    expect(evaluateAtoms([{ value: true }, { op: 'and', value: true }, { op: 'or', value: false }])).toBe(true);
    // F || T && F => false || (T && F) => false
    expect(evaluateAtoms([{ value: false }, { op: 'or', value: true }, { op: 'and', value: false }])).toBe(false);
    // F || T && T => false || (T && T) => true
    expect(evaluateAtoms([{ value: false }, { op: 'or', value: true }, { op: 'and', value: true }])).toBe(true);
  });

  it('chains AND only', () => {
    expect(evaluateAtoms([{ value: true }, { op: 'and', value: true }, { op: 'and', value: true }])).toBe(true);
    expect(evaluateAtoms([{ value: true }, { op: 'and', value: true }, { op: 'and', value: false }])).toBe(false);
  });

  it('chains OR only', () => {
    expect(evaluateAtoms([{ value: false }, { op: 'or', value: false }, { op: 'or', value: true }])).toBe(true);
    expect(evaluateAtoms([{ value: false }, { op: 'or', value: false }, { op: 'or', value: false }])).toBe(false);
  });
});

describe('applyComparison', () => {
  it('supports equality variants', () => {
    expect(applyComparison('a', '=', 'a')).toBe(true);
    expect(applyComparison('a', '==', 'a')).toBe(true);
    expect(applyComparison('a', '!=', 'b')).toBe(true);
  });

  it('supports ordering operators', () => {
    expect(applyComparison(2, '>', 1)).toBe(true);
    expect(applyComparison(2, '<', 1)).toBe(false);
    expect(applyComparison(2, '>=', 2)).toBe(true);
    expect(applyComparison(2, '<=', 2)).toBe(true);
  });

  it('iLike is substring on strings only (legacy case-sensitive)', () => {
    expect(applyComparison('TechCorp Inc', 'iLike', 'Tech')).toBe(true);
    expect(applyComparison('TechCorp Inc', 'iLike', 'xyz')).toBe(false);
    expect(applyComparison(123 as any, 'iLike', 'tech')).toBe(false);
  });

  it('throws on unknown operator', () => {
    expect(() => applyComparison(1, 'bogus', 1)).toThrow(/Unsupported comparison operator/);
  });
});

describe('safeGetPath', () => {
  it('resolves dot paths', () => {
    expect(safeGetPath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
  });

  it('returns undefined for missing keys', () => {
    expect(safeGetPath({ a: 1 }, 'b')).toBeUndefined();
    expect(safeGetPath({ a: 1 }, 'a.b')).toBeUndefined();
  });

  it('rejects prototype-polluting keys', () => {
    expect(safeGetPath({}, '__proto__')).toBeUndefined();
    expect(safeGetPath({}, 'constructor')).toBeUndefined();
    expect(safeGetPath({}, 'a.__proto__.polluted')).toBeUndefined();
  });

  it('returns undefined for non-own props', () => {
    expect(safeGetPath({}, 'toString')).toBeUndefined();
  });
});

describe('safeOwnProp / hasSafeOwnProp', () => {
  it('returns own props only', () => {
    expect(safeOwnProp({ a: 1 }, 'a')).toBe(1);
    expect(safeOwnProp({ a: 1 }, 'toString')).toBeUndefined();
    expect(hasSafeOwnProp({ a: 1 }, 'a')).toBe(true);
    expect(hasSafeOwnProp({ a: 1 }, 'toString')).toBe(false);
  });

  it('rejects prototype keys', () => {
    expect(safeOwnProp({}, '__proto__')).toBeUndefined();
    expect(hasSafeOwnProp({}, '__proto__')).toBe(false);
  });
});

describe('assertAllowedClickhouseOperator', () => {
  it('passes allowed operators', () => {
    for (const op of ['=', '!=', '<', '>', '<=', '>=']) {
      expect(assertAllowedClickhouseOperator(op)).toBe(op);
    }
  });

  it('rejects SQL-injection attempts', () => {
    expect(() => assertAllowedClickhouseOperator("= '' UNION SELECT * FROM users --")).toThrow(/Disallowed/);
    expect(() => assertAllowedClickhouseOperator('OR 1=1')).toThrow(/Disallowed/);
    expect(() => assertAllowedClickhouseOperator(undefined)).toThrow(/Disallowed/);
  });
});

describe('assertIsoDate', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(assertIsoDate('2026-05-15', 'd')).toBe('2026-05-15');
  });

  it('rejects malformed dates and injection attempts', () => {
    expect(() => assertIsoDate("2026-05-15'; DROP TABLE users --", 'd')).toThrow(/Invalid date/);
    expect(() => assertIsoDate('2026/05/15', 'd')).toThrow(/Invalid date/);
    expect(() => assertIsoDate('', 'd')).toThrow(/Invalid date/);
    expect(() => assertIsoDate(undefined, 'd')).toThrow(/Invalid date/);
  });
});
