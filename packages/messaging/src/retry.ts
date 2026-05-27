export function computeBackoffMs(attempt: number, baseMs: number, maxMs: number): number {
  if (baseMs <= 0) return 0;
  if (maxMs < baseMs) return maxMs;
  if (attempt < 1) return baseMs;

  const multiplier = 2 ** (attempt - 1);
  if (!Number.isFinite(multiplier)) return maxMs;

  const computed = baseMs * multiplier;
  if (!Number.isFinite(computed)) return maxMs;

  return Math.min(computed, maxMs);
}
