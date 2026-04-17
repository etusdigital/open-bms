import { DATE_RANGE_PRESETS, DELIVERY_RATE_THRESHOLDS, CACHE_TTL, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, BASELINE_LOOKBACK_WEEKDAY_DAYS, BASELINE_LOOKBACK_WEEKEND_DAYS } from './constants';

describe('constants', () => {
  describe('DATE_RANGE_PRESETS', () => {
    it('should define standard presets', () => {
      expect(DATE_RANGE_PRESETS['24h']).toEqual({ hours: 24 });
      expect(DATE_RANGE_PRESETS['7d']).toEqual({ days: 7 });
      expect(DATE_RANGE_PRESETS['30d']).toEqual({ days: 30 });
      expect(DATE_RANGE_PRESETS['90d']).toEqual({ days: 90 });
    });
  });

  describe('DELIVERY_RATE_THRESHOLDS', () => {
    it('should have good threshold above warning', () => {
      expect(DELIVERY_RATE_THRESHOLDS.good).toBeGreaterThan(DELIVERY_RATE_THRESHOLDS.warning);
    });

    it('should have sensible values', () => {
      expect(DELIVERY_RATE_THRESHOLDS.good).toBe(97);
      expect(DELIVERY_RATE_THRESHOLDS.warning).toBe(95);
    });
  });

  describe('CACHE_TTL', () => {
    it('should have positive TTL values', () => {
      expect(CACHE_TTL.dashboard).toBeGreaterThan(0);
      expect(CACHE_TTL.reports).toBeGreaterThan(0);
      expect(CACHE_TTL.accounts).toBeGreaterThan(0);
      expect(CACHE_TTL.filters).toBeGreaterThan(0);
    });

    it('should have dashboard TTL shorter than reports', () => {
      expect(CACHE_TTL.dashboard).toBeLessThan(CACHE_TTL.reports);
    });
  });

  describe('pagination constants', () => {
    it('should have defaults', () => {
      expect(PAGE_SIZE_DEFAULT).toBe(50);
      expect(PAGE_SIZE_MAX).toBe(200);
    });

    it('should have max greater than default', () => {
      expect(PAGE_SIZE_MAX).toBeGreaterThan(PAGE_SIZE_DEFAULT);
    });
  });

  describe('BASELINE_LOOKBACK_*_DAYS', () => {
    it('should have weekday lookback at 28 days', () => {
      expect(BASELINE_LOOKBACK_WEEKDAY_DAYS).toBe(28);
    });

    it('should have weekend lookback at 35 days', () => {
      expect(BASELINE_LOOKBACK_WEEKEND_DAYS).toBe(35);
    });

    it('should have weekend lookback longer than weekday', () => {
      expect(BASELINE_LOOKBACK_WEEKEND_DAYS).toBeGreaterThan(BASELINE_LOOKBACK_WEEKDAY_DAYS);
    });
  });
});
