import i18n from '@/lib/i18n';

/** Calculate percentage: (dividend / divider) * 100, formatted to 1 decimal */
export function pct(dividend: unknown, divider: unknown): string {
  const d = Number(dividend) || 0;
  const v = Number(divider) || 0;
  if (!d || !v) return '0.0';
  return ((d / v) * 100).toFixed(1);
}

/** Format a number with locale-aware thousands separators */
export function fmt(n: unknown): string {
  return Number(n).toLocaleString(i18n.language);
}
