import { describe, it, expect } from 'vitest';
import { getPercentage, formatCompact } from '../constants';

describe('getPercentage', () => {
  it('returns correct percentage', () => {
    expect(getPercentage(50, 200)).toBe(25);
  });

  it('returns 0 when total is 0', () => {
    expect(getPercentage(50, 0)).toBe(0);
  });

  it('returns 0 when partial is 0', () => {
    expect(getPercentage(0, 200)).toBe(0);
  });

  it('returns 0 when total is null/undefined', () => {
    expect(getPercentage(50, null as unknown as number)).toBe(0);
    expect(getPercentage(50, undefined as unknown as number)).toBe(0);
  });

  it('returns 0 when partial is null/undefined', () => {
    expect(getPercentage(null as unknown as number, 200)).toBe(0);
    expect(getPercentage(undefined as unknown as number, 200)).toBe(0);
  });

  it('rounds to 2 decimal places', () => {
    expect(getPercentage(1, 3)).toBe(33.33);
  });

  it('can return values > 100', () => {
    expect(getPercentage(300, 200)).toBe(150);
  });
});

describe('formatCompact', () => {
  it('formats millions', () => {
    expect(formatCompact(1500000)).toBe('1.5M');
    expect(formatCompact(1000000)).toBe('1M');
  });

  it('formats thousands', () => {
    expect(formatCompact(1500)).toBe('1.5K');
    expect(formatCompact(1000)).toBe('1K');
  });

  it('returns raw number below 1000', () => {
    expect(formatCompact(999)).toBe('999');
    expect(formatCompact(0)).toBe('0');
  });

  it('handles negative values', () => {
    expect(formatCompact(-1500000)).toBe('-1.5M');
  });
});
