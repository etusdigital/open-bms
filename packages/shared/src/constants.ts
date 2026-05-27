export const DATE_RANGE_PRESETS = {
  '24h': { hours: 24 },
  '7d': { days: 7 },
  '30d': { days: 30 },
  '90d': { days: 90 },
} as const;

export const DELIVERY_RATE_THRESHOLDS = {
  good: 97,
  warning: 95,
} as const;

export const CACHE_TTL = {
  dashboard: 120, // 2 minutes
  reports: 300, // 5 minutes
  accounts: 600, // 10 minutes
  filters: 300, // 5 minutes
} as const;

export const PAGE_SIZE_DEFAULT = 50;
export const PAGE_SIZE_MAX = 200;

/** Baseline lookback window for weekday comparisons (Mon-Fri).
 *  28 days guarantees up to 4 same-weekday samples when minDataPoints >= 5. */
export const BASELINE_LOOKBACK_WEEKDAY_DAYS = 28;

/** Baseline lookback window for weekend comparisons (Sat-Sun).
 *  Slightly longer to accumulate at least 5 weekend samples when traffic is sparse. */
export const BASELINE_LOOKBACK_WEEKEND_DAYS = 35;
