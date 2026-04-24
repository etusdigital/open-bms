import { computeBackoffMs } from './retry';

describe('computeBackoffMs', () => {
  describe('standard exponential backoff', () => {
    it.each([
      { attempt: 1, base: 1000, max: 60_000, expected: 1000 },
      { attempt: 2, base: 1000, max: 60_000, expected: 2000 },
      { attempt: 3, base: 1000, max: 60_000, expected: 4000 },
      { attempt: 5, base: 1000, max: 60_000, expected: 16_000 },
      { attempt: 6, base: 1000, max: 60_000, expected: 32_000 },
      { attempt: 7, base: 1000, max: 60_000, expected: 60_000 },
      { attempt: 20, base: 1000, max: 60_000, expected: 60_000 },
    ])('attempt=$attempt, base=$base, max=$max → $expected', ({ attempt, base, max, expected }) => {
      expect(computeBackoffMs(attempt, base, max)).toBe(expected);
    });
  });

  describe('guards', () => {
    it('returns baseMs when attempt is 0', () => {
      expect(computeBackoffMs(0, 1000, 60_000)).toBe(1000);
    });

    it('returns baseMs when attempt is negative', () => {
      expect(computeBackoffMs(-5, 1000, 60_000)).toBe(1000);
    });

    it('returns 0 when baseMs is 0', () => {
      expect(computeBackoffMs(1, 0, 60_000)).toBe(0);
    });

    it('returns 0 when baseMs is negative', () => {
      expect(computeBackoffMs(1, -100, 60_000)).toBe(0);
    });

    it('returns maxMs when maxMs < baseMs', () => {
      expect(computeBackoffMs(1, 1000, 500)).toBe(500);
    });
  });

  describe('overflow protection', () => {
    it('caps at maxMs for astronomical attempt values', () => {
      expect(computeBackoffMs(2000, 1000, 60_000)).toBe(60_000);
    });
  });
});
