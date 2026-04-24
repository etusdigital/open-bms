import type { AlertType, AlertSeverity, StatisticalBaseline } from './types';

// ── V1 (legacy — kept temporarily for validation) ──

export interface AlertThreshold {
  type: AlertType;
  warningMultiplier: number | null;
  criticalMultiplier: number | null;
  /** For rate-based thresholds (spam), absolute percentages */
  warningRate?: number;
  criticalRate?: number;
  /** Minimum event count to trigger */
  minEvents?: number;
}

export const ALERT_THRESHOLDS: AlertThreshold[] = [
  {
    type: 'bounce_spike',
    warningMultiplier: 2,
    criticalMultiplier: 3,
    minEvents: 50,
  },
  {
    type: 'deferred_spike',
    warningMultiplier: 3,
    criticalMultiplier: 5,
    minEvents: 100,
  },
  {
    type: 'volume_drop',
    warningMultiplier: 0.5, // <50% of baseline
    criticalMultiplier: 0.25, // <25% of baseline
    minEvents: 100,
  },
  {
    type: 'volume_spike',
    warningMultiplier: 3,
    criticalMultiplier: 5,
    minEvents: 100,
  },
  {
    type: 'spam_spike',
    warningMultiplier: null,
    criticalMultiplier: null,
    warningRate: 0.1, // >0.1% of delivered
    criticalRate: 0.3, // >0.3% of delivered
    minEvents: 50,
  },
  {
    type: 'block_detected',
    warningMultiplier: null,
    criticalMultiplier: null,
    minEvents: 10,
  },
];

export function getSeverity(type: AlertType, currentValue: number, baselineValue: number): AlertSeverity | null {
  const threshold = ALERT_THRESHOLDS.find((t) => t.type === type);
  if (!threshold) return null;

  if (type === 'block_detected') {
    return currentValue >= (threshold.minEvents ?? 10) ? 'critical' : null;
  }

  if (type === 'spam_spike') {
    if (currentValue >= (threshold.criticalRate ?? 0.3)) return 'critical';
    if (currentValue >= (threshold.warningRate ?? 0.1)) return 'warning';
    return null;
  }

  if (type === 'volume_drop') {
    if (baselineValue === 0) return null;
    const ratio = currentValue / baselineValue;
    if (ratio <= (threshold.criticalMultiplier ?? 0.25)) return 'critical';
    if (ratio <= (threshold.warningMultiplier ?? 0.5)) return 'warning';
    return null;
  }

  // Spike-based: bounce_spike, deferred_spike, volume_spike
  if (baselineValue === 0) return currentValue > 0 ? 'warning' : null;
  const ratio = currentValue / baselineValue;
  if (threshold.criticalMultiplier && ratio >= threshold.criticalMultiplier) return 'critical';
  if (threshold.warningMultiplier && ratio >= threshold.warningMultiplier) return 'warning';
  return null;
}

// ── V2: Statistical baseline (Median + IQR) ──

export interface AlertThresholdV2 {
  type: AlertType;
  warningZScore: number;
  criticalZScore: number;
  /** Minimum events in current period to trigger */
  minEvents: number;
  /** Minimum historical data points required */
  minDataPoints: number;
  /** Absolute floor: current value must exceed this to fire */
  absoluteFloor: number;
  /** Minimum spread to avoid division-by-near-zero */
  minSpread: number;
  /** Minimum spread as a percentage of median (e.g., 0.05 = 5%).
   *  Prevents tiny IQR on consistent pools from causing false alerts. */
  minSpreadPct: number;
  /** Minimum absolute deviation from median required to fire.
   *  Prevents high z-scores on small absolute changes (e.g., 600 vs 354). */
  minAbsoluteDeviation: number;
  /** Minimum baseline median required to fire a spike alert.
   *  Prevents false positives for dormant/new senders whose near-zero
   *  historical volume makes any real send look like an extreme spike. */
  minBaselineMedian?: number;
  /** For rate-based thresholds (spam), absolute percentages */
  warningRate?: number;
  criticalRate?: number;
}

export const ALERT_THRESHOLDS_V2: AlertThresholdV2[] = [
  {
    type: 'bounce_spike',
    warningZScore: 3.0,
    criticalZScore: 4.5,
    minEvents: 200,
    minDataPoints: 5,
    absoluteFloor: 20,
    minSpread: 1,
    minSpreadPct: 0.05,
    minAbsoluteDeviation: 50,
  },
  {
    type: 'deferred_spike',
    warningZScore: 3.0,
    criticalZScore: 4.5,
    minEvents: 200,
    minDataPoints: 5,
    absoluteFloor: 50,
    minSpread: 1,
    minSpreadPct: 0.05,
    minAbsoluteDeviation: 100,
  },
  {
    type: 'volume_spike',
    warningZScore: 4.0,
    criticalZScore: 6.0,
    minEvents: 200,
    minDataPoints: 5,
    absoluteFloor: 500,
    minSpread: 1,
    minSpreadPct: 0.1,
    minAbsoluteDeviation: 0,
    minBaselineMedian: 50,
  },
  {
    type: 'volume_drop',
    warningZScore: -4.0,
    criticalZScore: -6.0,
    minEvents: 0, // not applicable — we check baseline median instead
    minDataPoints: 5,
    absoluteFloor: 200, // baseline median must exceed this
    minSpread: 1,
    minSpreadPct: 0.1,
    minAbsoluteDeviation: 0,
  },
  {
    type: 'spam_spike',
    warningZScore: 0, // uses absolute rates
    criticalZScore: 0,
    minEvents: 200,
    minDataPoints: 0,
    absoluteFloor: 0,
    minSpread: 1,
    minSpreadPct: 0,
    minAbsoluteDeviation: 0,
    warningRate: 0.1,
    criticalRate: 0.3,
  },
  {
    type: 'block_detected',
    warningZScore: 0, // uses absolute count
    criticalZScore: 0,
    minEvents: 10,
    minDataPoints: 0,
    absoluteFloor: 0,
    minSpread: 1,
    minSpreadPct: 0,
    minAbsoluteDeviation: 0,
  },
];

/**
 * Compute z-score from a statistical baseline.
 * z = (current - median) / max(spread, minSpread, median * minSpreadPct)
 *
 * The minSpreadPct floor prevents tight-IQR pools (very consistent traffic)
 * from producing extreme z-scores on small absolute changes.
 */
export function computeZScore(
  currentValue: number,
  baseline: StatisticalBaseline,
  minSpread: number,
  minSpreadPct: number = 0,
): number {
  const pctFloor = Math.abs(baseline.median) * minSpreadPct;
  const effectiveSpread = Math.max(baseline.spread, minSpread, pctFloor);
  return (currentValue - baseline.median) / effectiveSpread;
}

/** Clamp z-score to [-20, 20] for human-readable display */
const clampZScore = (z: number): number => Math.max(-20, Math.min(20, z));

/**
 * Determine severity using z-score-based thresholds.
 * Returns { severity, zScore } or null if no alert should fire.
 */
export function getSeverityV2(
  type: AlertType,
  currentValue: number,
  baseline: StatisticalBaseline | null,
): { severity: AlertSeverity; zScore: number } | null {
  const threshold = ALERT_THRESHOLDS_V2.find((t) => t.type === type);
  if (!threshold) return null;

  // block_detected: absolute count, no baseline needed
  if (type === 'block_detected') {
    return currentValue >= threshold.minEvents ? { severity: 'critical', zScore: 0 } : null;
  }

  // spam_spike: absolute rate, no baseline needed
  if (type === 'spam_spike') {
    if (currentValue >= (threshold.criticalRate ?? 0.3)) return { severity: 'critical', zScore: 0 };
    if (currentValue >= (threshold.warningRate ?? 0.1)) return { severity: 'warning', zScore: 0 };
    return null;
  }

  // All other types require a valid baseline
  if (!baseline || baseline.dataPoints < threshold.minDataPoints) return null;

  const zScore = computeZScore(currentValue, baseline, threshold.minSpread, threshold.minSpreadPct);

  if (type === 'volume_drop') {
    // Drop: baseline median must be large enough to matter
    if (baseline.median < threshold.absoluteFloor) return null;
    if (Math.abs(currentValue - baseline.median) < threshold.minAbsoluteDeviation) return null;
    if (zScore <= threshold.criticalZScore) return { severity: 'critical', zScore: clampZScore(zScore) };
    if (zScore <= threshold.warningZScore) return { severity: 'warning', zScore: clampZScore(zScore) };
    return null;
  }

  // Spike-based: bounce_spike, deferred_spike, volume_spike
  if (currentValue < threshold.absoluteFloor) return null;
  if (threshold.minBaselineMedian !== undefined && baseline.median < threshold.minBaselineMedian) return null;
  if (currentValue < threshold.minEvents) return null;
  if (Math.abs(currentValue - baseline.median) < threshold.minAbsoluteDeviation) return null;
  if (zScore >= threshold.criticalZScore) return { severity: 'critical', zScore: clampZScore(zScore) };
  if (zScore >= threshold.warningZScore) return { severity: 'warning', zScore: clampZScore(zScore) };
  return null;
}
