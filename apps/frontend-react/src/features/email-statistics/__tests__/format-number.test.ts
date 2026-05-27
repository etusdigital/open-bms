import { describe, it, expect } from 'vitest';
import { formatNumber } from '../utils/format-number';

describe('formatNumber', () => {
  it('formats with pt-BR locale (dots as thousands separator)', () => {
    expect(formatNumber(1000000, 'pt-BR')).toBe('1.000.000');
  });

  it('formats with en-US locale (commas as thousands separator)', () => {
    expect(formatNumber(1000000, 'en-US')).toBe('1,000,000');
  });

  it('formats zero', () => {
    expect(formatNumber(0, 'pt-BR')).toBe('0');
  });

  it('formats small numbers without separator', () => {
    expect(formatNumber(999, 'pt-BR')).toBe('999');
  });

  it('handles negative numbers', () => {
    expect(formatNumber(-5000, 'en-US')).toBe('-5,000');
  });

  it('handles decimals', () => {
    const result = formatNumber(1234.56, 'pt-BR');
    expect(result).toContain('1.234');
  });

  it('caches formatter per locale (returns consistent results)', () => {
    const a = formatNumber(1000, 'pt-BR');
    const b = formatNumber(1000, 'pt-BR');
    expect(a).toBe(b);
  });
});
