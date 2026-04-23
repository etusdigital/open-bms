import { getSeverity, ALERT_THRESHOLDS, getSeverityV2, computeZScore, ALERT_THRESHOLDS_V2 } from './thresholds';
import type { StatisticalBaseline } from './types';

describe('ALERT_THRESHOLDS', () => {
  it('should define thresholds for all expected alert types', () => {
    const types = ALERT_THRESHOLDS.map((t) => t.type);
    expect(types).toContain('bounce_spike');
    expect(types).toContain('deferred_spike');
    expect(types).toContain('volume_drop');
    expect(types).toContain('volume_spike');
    expect(types).toContain('spam_spike');
    expect(types).toContain('block_detected');
  });
});

describe('getSeverity', () => {
  describe('bounce_spike', () => {
    it('should return null when below threshold', () => {
      expect(getSeverity('bounce_spike', 10, 10)).toBeNull();
    });

    it('should return warning at 2x baseline', () => {
      expect(getSeverity('bounce_spike', 20, 10)).toBe('warning');
    });

    it('should return critical at 3x baseline', () => {
      expect(getSeverity('bounce_spike', 30, 10)).toBe('critical');
    });

    it('should return warning when baseline is 0 and current > 0', () => {
      expect(getSeverity('bounce_spike', 5, 0)).toBe('warning');
    });

    it('should return null when both are 0', () => {
      expect(getSeverity('bounce_spike', 0, 0)).toBeNull();
    });
  });

  describe('deferred_spike', () => {
    it('should return null when below threshold', () => {
      expect(getSeverity('deferred_spike', 10, 10)).toBeNull();
    });

    it('should return warning at 3x baseline', () => {
      expect(getSeverity('deferred_spike', 30, 10)).toBe('warning');
    });

    it('should return critical at 5x baseline', () => {
      expect(getSeverity('deferred_spike', 50, 10)).toBe('critical');
    });
  });

  describe('volume_drop', () => {
    it('should return null when volume is normal', () => {
      expect(getSeverity('volume_drop', 100, 100)).toBeNull();
    });

    it('should return null when baseline is 0', () => {
      expect(getSeverity('volume_drop', 0, 0)).toBeNull();
    });

    it('should return warning when volume drops below 50%', () => {
      expect(getSeverity('volume_drop', 40, 100)).toBe('warning');
    });

    it('should return critical when volume drops below 25%', () => {
      expect(getSeverity('volume_drop', 20, 100)).toBe('critical');
    });

    it('should return null when volume is at 60%', () => {
      expect(getSeverity('volume_drop', 60, 100)).toBeNull();
    });

    it('should return warning when volume is exactly at 50%', () => {
      expect(getSeverity('volume_drop', 50, 100)).toBe('warning');
    });

    it('should return critical when volume is exactly at 25%', () => {
      expect(getSeverity('volume_drop', 25, 100)).toBe('critical');
    });
  });

  describe('volume_spike', () => {
    it('should return null when below threshold', () => {
      expect(getSeverity('volume_spike', 100, 100)).toBeNull();
    });

    it('should return warning at 3x baseline', () => {
      expect(getSeverity('volume_spike', 300, 100)).toBe('warning');
    });

    it('should return critical at 5x baseline', () => {
      expect(getSeverity('volume_spike', 500, 100)).toBe('critical');
    });
  });

  describe('spam_spike', () => {
    it('should return null when below warning rate', () => {
      expect(getSeverity('spam_spike', 0.05, 0)).toBeNull();
    });

    it('should return warning at 0.1% rate', () => {
      expect(getSeverity('spam_spike', 0.1, 0)).toBe('warning');
    });

    it('should return critical at 0.3% rate', () => {
      expect(getSeverity('spam_spike', 0.3, 0)).toBe('critical');
    });

    it('should return warning between 0.1% and 0.3%', () => {
      expect(getSeverity('spam_spike', 0.2, 0)).toBe('warning');
    });
  });

  describe('block_detected', () => {
    it('should return null when below min events', () => {
      expect(getSeverity('block_detected', 5, 0)).toBeNull();
    });

    it('should return critical when at or above min events', () => {
      expect(getSeverity('block_detected', 10, 0)).toBe('critical');
    });

    it('should return critical when well above min events', () => {
      expect(getSeverity('block_detected', 100, 0)).toBe('critical');
    });
  });

  describe('unknown type', () => {
    it('should return null for unknown alert type', () => {
      expect(getSeverity('unknown_type' as any, 100, 10)).toBeNull();
    });
  });
});

// ── V2: Statistical baseline tests ──

describe('ALERT_THRESHOLDS_V2', () => {
  it('should define thresholds for all expected alert types', () => {
    const types = ALERT_THRESHOLDS_V2.map((t) => t.type);
    expect(types).toContain('bounce_spike');
    expect(types).toContain('deferred_spike');
    expect(types).toContain('volume_drop');
    expect(types).toContain('volume_spike');
    expect(types).toContain('spam_spike');
    expect(types).toContain('block_detected');
  });
});

describe('computeZScore', () => {
  it('should compute correct z-score with normal spread', () => {
    const baseline: StatisticalBaseline = { median: 10, spread: 5, dataPoints: 10 };
    expect(computeZScore(25, baseline, 1)).toBe(3);
  });

  it('should use minSpread when spread is too small', () => {
    const baseline: StatisticalBaseline = { median: 10, spread: 0.1, dataPoints: 10 };
    // z = (15 - 10) / max(0.1, 1) = 5 / 1 = 5
    expect(computeZScore(15, baseline, 1)).toBe(5);
  });

  it('should return negative z-score for drops', () => {
    const baseline: StatisticalBaseline = { median: 100, spread: 20, dataPoints: 10 };
    expect(computeZScore(40, baseline, 1)).toBe(-3);
  });

  it('should use minSpreadPct floor when spread is tight relative to median', () => {
    // median=10000, spread=5 (very tight IQR), minSpread=1, minSpreadPct=0.05
    // pctFloor = 10000 * 0.05 = 500
    // effectiveSpread = max(5, 1, 500) = 500
    // z = (9500 - 10000) / 500 = -1.0
    const baseline: StatisticalBaseline = { median: 10000, spread: 5, dataPoints: 10 };
    expect(computeZScore(9500, baseline, 1, 0.05)).toBe(-1);
  });

  it('should not affect z-score when spread already exceeds pct floor', () => {
    // median=100, spread=20, minSpreadPct=0.05
    // pctFloor = 100 * 0.05 = 5, effectiveSpread = max(20, 1, 5) = 20
    const baseline: StatisticalBaseline = { median: 100, spread: 20, dataPoints: 10 };
    expect(computeZScore(40, baseline, 1, 0.05)).toBe(-3);
  });
});

describe('getSeverityV2', () => {
  describe('bounce_spike', () => {
    const makeBaseline = (median: number, spread: number, dp = 10): StatisticalBaseline => ({
      median,
      spread,
      dataPoints: dp,
    });

    it('should return null when below z-score threshold', () => {
      // z = (50 - 10) / 20 = 2.0 < 3.0, but also current (50) < minEvents (200)
      // Use values where z < 3 AND current >= minEvents
      // z = (250 - 200) / 50 = 1.0 < 3.0
      expect(getSeverityV2('bounce_spike', 250, makeBaseline(200, 50))).toBeNull();
    });

    it('should return warning at z >= 3.0', () => {
      // z = (200 - 50) / 50 = 3.0
      const result = getSeverityV2('bounce_spike', 200, makeBaseline(50, 50));
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
      expect(result!.zScore).toBe(3);
    });

    it('should return critical at z >= 4.5', () => {
      // z = (275 - 50) / 50 = 4.5
      const result = getSeverityV2('bounce_spike', 275, makeBaseline(50, 50));
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
      expect(result!.zScore).toBe(4.5);
    });

    it('should return null when current value below absolute floor (20)', () => {
      // z would be high, but current value < 20
      const result = getSeverityV2('bounce_spike', 15, makeBaseline(1, 1));
      expect(result).toBeNull();
    });

    it('should return null when current value below minEvents (200)', () => {
      // z = (100 - 10) / 5 = 18 but current < 200
      const result = getSeverityV2('bounce_spike', 100, makeBaseline(10, 5));
      expect(result).toBeNull();
    });

    it('should return null when insufficient data points (< 5)', () => {
      const result = getSeverityV2('bounce_spike', 500, makeBaseline(10, 5, 4));
      expect(result).toBeNull();
    });

    it('should fire with exactly 5 data points', () => {
      // z = (300 - 50) / 50 = 5.0 → critical
      const result = getSeverityV2('bounce_spike', 300, makeBaseline(50, 50, 5));
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
    });

    it('should return null when absolute deviation below minAbsoluteDeviation (50)', () => {
      // z = (240 - 200) / 10 = 4.0 → warning, BUT |240-200| = 40 < 50
      const result = getSeverityV2('bounce_spike', 240, makeBaseline(200, 10));
      expect(result).toBeNull();
    });

    it('should return null with no baseline', () => {
      expect(getSeverityV2('bounce_spike', 500, null)).toBeNull();
    });
  });

  describe('volume_drop', () => {
    const makeBaseline = (median: number, spread: number, dp = 10): StatisticalBaseline => ({
      median,
      spread,
      dataPoints: dp,
    });

    it('should return null when volume is normal', () => {
      // median=2000, spread=200 → pctFloor=2000*0.10=200, effectiveSpread=max(200,1,200)=200
      // z = (1900 - 2000) / 200 = -0.5 > -4.0
      expect(getSeverityV2('volume_drop', 1900, makeBaseline(2000, 200))).toBeNull();
    });

    it('should return warning at z <= -4.0', () => {
      // median=2000, spread=200 → pctFloor=200, effectiveSpread=200
      // z = (1200 - 2000) / 200 = -4.0, |1200-2000|=800 >= 500
      const result = getSeverityV2('volume_drop', 1200, makeBaseline(2000, 200));
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
      expect(result!.zScore).toBe(-4);
    });

    it('should return critical at z <= -6.0', () => {
      // median=2000, spread=200 → pctFloor=200, effectiveSpread=200
      // z = (800 - 2000) / 200 = -6.0, |800-2000|=1200 >= 500
      const result = getSeverityV2('volume_drop', 800, makeBaseline(2000, 200));
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
      expect(result!.zScore).toBe(-6);
    });

    it('should return null when baseline median below absoluteFloor (200)', () => {
      // median 50 < 200 → skip
      expect(getSeverityV2('volume_drop', 0, makeBaseline(50, 10))).toBeNull();
    });

    it('should return null with insufficient data points (< 5)', () => {
      expect(getSeverityV2('volume_drop', 0, makeBaseline(500, 20, 4))).toBeNull();
    });

    it('should fire on significant volume drop (minAbsDev=0 for volume types)', () => {
      // median=1000, spread=50, current=400 → |400-1000|=600
      // pctFloor=1000*0.10=100, effectiveSpread=max(50,1,100)=100
      // z = (400-1000)/100 = -6.0 → critical
      const result = getSeverityV2('volume_drop', 400, makeBaseline(1000, 50));
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
    });
  });

  describe('volume_spike', () => {
    const makeBaseline = (median: number, spread: number, dp = 10): StatisticalBaseline => ({
      median,
      spread,
      dataPoints: dp,
    });

    it('should return null when baseline median is below minBaselineMedian (50)', () => {
      // Reproduces the pecaoseu.com false positive: baseline=13, current=5172
      // Without minBaselineMedian, effectiveSpread ≈ max(spread, 1, 13×0.10) ≈ 1.3 → z≈3968 → fires
      const result = getSeverityV2('volume_spike', 5172, makeBaseline(13, 5));
      expect(result).toBeNull();
    });

    it('should fire when baseline median meets minBaselineMedian (50)', () => {
      // median=500, spread=1 → pctFloor=50, effectiveSpread=50
      // z = (1400-500)/50 = 18 → critical; current=1400 > absoluteFloor=500 and minEvents=200
      const result = getSeverityV2('volume_spike', 1400, makeBaseline(500, 1));
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
    });

    it('should return null when baseline median is exactly at threshold boundary (49)', () => {
      const result = getSeverityV2('volume_spike', 5000, makeBaseline(49, 5));
      expect(result).toBeNull();
    });

    it('should fire when baseline median is exactly at threshold (50)', () => {
      // median=50, spread=1 → pctFloor=50×0.10=5, effectiveSpread=max(1,1,5)=5
      // z = (600-50)/5 = 110 → clamped to 20 → critical; current=600>absoluteFloor=500
      const result = getSeverityV2('volume_spike', 600, makeBaseline(50, 1));
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
    });
  });

  describe('spam_spike (absolute rate)', () => {
    it('should return null below 0.1%', () => {
      expect(getSeverityV2('spam_spike', 0.05, null)).toBeNull();
    });

    it('should return warning at 0.1%', () => {
      const result = getSeverityV2('spam_spike', 0.1, null);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
    });

    it('should return critical at 0.3%', () => {
      const result = getSeverityV2('spam_spike', 0.3, null);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
    });
  });

  describe('block_detected (absolute count)', () => {
    it('should return null below minEvents', () => {
      expect(getSeverityV2('block_detected', 5, null)).toBeNull();
    });

    it('should return critical at or above minEvents', () => {
      const result = getSeverityV2('block_detected', 10, null);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
    });
  });

  describe('tight-spread scaling (minSpreadPct)', () => {
    const makeBaseline = (median: number, spread: number, dp = 10): StatisticalBaseline => ({
      median,
      spread,
      dataPoints: dp,
    });

    it('should not alert on small absolute volume drop when spread is tight', () => {
      // median=10000, spread=5 → pctFloor=10000*0.10=1000 → effectiveSpread=1000
      // current=9500, z=(9500-10000)/1000 = -0.5 → no alert
      expect(getSeverityV2('volume_drop', 9500, makeBaseline(10000, 5))).toBeNull();
    });

    it('should still alert on large volume drop even with pct floor', () => {
      // median=10000, spread=5 → pctFloor=10000*0.10=1000 → effectiveSpread=1000
      // current=4000, z=(4000-10000)/1000 = -6.0 → critical
      const result = getSeverityV2('volume_drop', 4000, makeBaseline(10000, 5));
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
    });

    it('should not alert on small volume spike when spread is tight', () => {
      // median=1000, spread=10 → pctFloor=1000*0.10=100 → effectiveSpread=100
      // current=1100, z=(1100-1000)/100 = 1.0 → no alert (< 4.0)
      // But also current=1100 > absoluteFloor=500 and > minEvents=200
      expect(getSeverityV2('volume_spike', 1100, makeBaseline(1000, 10))).toBeNull();
    });

    it('should alert on volume_spike with any absolute deviation (minAbsDev=0)', () => {
      // median=500, spread=1 → pctFloor=500*0.10=50 → effectiveSpread=50
      // current=1400, z=(1400-500)/50 = 18.0 → critical (minAbsDev=0 for volume types)
      const result = getSeverityV2('volume_spike', 1400, makeBaseline(500, 1));
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
    });
  });

  describe('z-score clamping', () => {
    const makeBaseline = (median: number, spread: number, dp = 10): StatisticalBaseline => ({
      median,
      spread,
      dataPoints: dp,
    });

    it('should clamp extreme positive z-score to 20', () => {
      // median=0, spread=0 → effectiveSpread=max(0, 1, 0)=1
      // current=500, z=500/1=500 → clamped to 20
      const result = getSeverityV2('deferred_spike', 500, makeBaseline(0, 0));
      expect(result).not.toBeNull();
      expect(result!.zScore).toBe(20);
    });

    it('should bound negative z-scores via pct floor for volume_drop', () => {
      // median=500, spread=1 → pctFloor=500*0.10=50 → effectiveSpread=50
      // current=0, z=(0-500)/50 = -10.0 → critical
      // The 10% pctFloor naturally bounds volume_drop z-scores to ~-10
      const result = getSeverityV2('volume_drop', 0, makeBaseline(500, 1));
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
      expect(result!.zScore).toBe(-10);
    });
  });

  describe('unknown type', () => {
    it('should return null for unknown alert type', () => {
      expect(getSeverityV2('unknown_type' as any, 100, null)).toBeNull();
    });
  });
});
