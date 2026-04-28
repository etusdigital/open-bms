import { describe, it, expect } from 'vitest';
import { WARMUP_LIMITS, WARMUP_COLORS, TARGET_OPTIONS, getWarmupDayForTarget } from '../constants';

describe('WARMUP_LIMITS', () => {
  it('has 25 entries', () => {
    expect(WARMUP_LIMITS).toHaveLength(25);
  });

  it('starts at 160 and ends at 500000', () => {
    expect(WARMUP_LIMITS[0]).toBe(160);
    expect(WARMUP_LIMITS[24]).toBe(500000);
  });

  it('is monotonically increasing', () => {
    for (let i = 1; i < WARMUP_LIMITS.length; i++) {
      expect(WARMUP_LIMITS[i]).toBeGreaterThan(WARMUP_LIMITS[i - 1]);
    }
  });
});

describe('TARGET_OPTIONS', () => {
  it('has 10 options', () => {
    expect(TARGET_OPTIONS).toHaveLength(10);
  });

  it('first option is 1000 target at 8 days', () => {
    expect(TARGET_OPTIONS[0]).toEqual(expect.objectContaining({ days: 8, target: 1000 }));
  });

  it('last option is 500000 target at 25 days', () => {
    expect(TARGET_OPTIONS[9]).toEqual(expect.objectContaining({ days: 25, target: 500000 }));
  });

  it('every target exists in WARMUP_LIMITS', () => {
    for (const opt of TARGET_OPTIONS) {
      expect(WARMUP_LIMITS).toContain(opt.target);
    }
  });
});

describe('WARMUP_COLORS', () => {
  it('has all expected color keys', () => {
    expect(WARMUP_COLORS).toHaveProperty('estimate');
    expect(WARMUP_COLORS).toHaveProperty('delivered');
    expect(WARMUP_COLORS).toHaveProperty('open');
    expect(WARMUP_COLORS).toHaveProperty('click');
    expect(WARMUP_COLORS).toHaveProperty('unsubscribe');
    expect(WARMUP_COLORS).toHaveProperty('bounce');
  });

  it('values are valid hex color strings', () => {
    for (const color of Object.values(WARMUP_COLORS)) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('getWarmupDayForTarget', () => {
  it('returns correct day for known targets', () => {
    expect(getWarmupDayForTarget(1000)).toBe(7); // index 6 + 1
    expect(getWarmupDayForTarget(10000)).toBe(14); // index 13 + 1
    expect(getWarmupDayForTarget(500000)).toBe(25); // index 24 + 1
  });

  it('returns 0 for unknown target', () => {
    expect(getWarmupDayForTarget(999999)).toBe(0);
  });
});
