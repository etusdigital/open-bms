import { describe, it, expect } from 'vitest';
import { pct, fmt } from '../editor/stat-utils';

describe('pct', () => {
  it('calculates percentage correctly', () => {
    expect(pct(50, 200)).toBe('25.0');
  });

  it('formats to 1 decimal place', () => {
    expect(pct(1, 3)).toBe('33.3');
  });

  it('returns 0.0 when dividend is 0', () => {
    expect(pct(0, 100)).toBe('0.0');
  });

  it('returns 0.0 when divider is 0', () => {
    expect(pct(100, 0)).toBe('0.0');
  });

  it('returns 0.0 when both are 0', () => {
    expect(pct(0, 0)).toBe('0.0');
  });

  it('handles string inputs', () => {
    expect(pct('400', '1000')).toBe('40.0');
  });

  it('handles mixed string and number inputs', () => {
    expect(pct('200', 1000)).toBe('20.0');
  });

  it('returns 0.0 for non-numeric strings', () => {
    expect(pct('abc', 100)).toBe('0.0');
  });

  it('calculates 100% correctly', () => {
    expect(pct(500, 500)).toBe('100.0');
  });

  it('calculates values over 100%', () => {
    expect(pct(200, 100)).toBe('200.0');
  });
});

describe('fmt', () => {
  it('formats a number', () => {
    const result = fmt(1000);
    // Locale-dependent, but should contain "1" and "000"
    expect(result).toContain('1');
    expect(result).toContain('000');
  });

  it('formats a string number', () => {
    const result = fmt('2500');
    expect(result).toContain('2');
    expect(result).toContain('500');
  });

  it('formats zero', () => {
    expect(fmt(0)).toBe('0');
  });

  it('handles non-numeric string', () => {
    expect(fmt('abc')).toBe('NaN');
  });
});
