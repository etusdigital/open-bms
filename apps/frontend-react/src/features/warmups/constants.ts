/** Warmup step progression — expected daily send volumes over 25 days */
export const WARMUP_LIMITS = [
  160, 224, 312, 440, 616, 864, 1000, 1688, 2360, 3304, 4632, 6480, 8000, 10000, 15000, 20000, 30000, 50000, 70000,
  85000, 100000, 150000, 250000, 350000, 500000,
] as const;

/** Predefined warmup target options: days → target volume */
export const TARGET_OPTIONS = [
  { days: 8, target: 1000, label: '1K (8 days)' },
  { days: 14, target: 10000, label: '10K (14 days)' },
  { days: 16, target: 20000, label: '20K (16 days)' },
  { days: 17, target: 30000, label: '30K (17 days)' },
  { days: 18, target: 50000, label: '50K (18 days)' },
  { days: 19, target: 70000, label: '70K (19 days)' },
  { days: 21, target: 100000, label: '100K (21 days)' },
  { days: 23, target: 250000, label: '250K (23 days)' },
  { days: 24, target: 350000, label: '350K (24 days)' },
  { days: 25, target: 500000, label: '500K (25 days)' },
] as const;

/** Shared color palette for warmup charts, tables, and metric cards */
export const WARMUP_COLORS = {
  estimate: '#7B61FF',
  delivered: '#0057f4',
  open: '#0FB75C',
  click: '#00CEFC',
  unsubscribe: '#F06158',
  bounce: '#FF9654',
} as const;

/** Returns the 1-based day number for a given target, or 0 if not found */
export function getWarmupDayForTarget(target: number): number {
  const index = WARMUP_LIMITS.indexOf(target as (typeof WARMUP_LIMITS)[number]);
  return index === -1 ? 0 : index + 1;
}
