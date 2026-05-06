import { HttpException, HttpStatus } from '@nestjs/common';

export const TEST_RATE_WINDOW_MS = 60_000;
export const TEST_RATE_MAX_PER_WINDOW = 5;

// Stateful rate limiter: each caller (service) owns a Map<bucketKey, hit timestamps[]>.
// bucketKey is typically `${provider}:${requesterIp}`.
export function enforceTestRateLimit(hits: Map<string, number[]>, bucketKey: string, providerLabel: string): void {
  const now = Date.now();
  const windowStart = now - TEST_RATE_WINDOW_MS;
  const bucket = (hits.get(bucketKey) ?? []).filter((t) => t > windowStart);
  if (bucket.length >= TEST_RATE_MAX_PER_WINDOW) {
    throw new HttpException(`Muitas tentativas de teste ${providerLabel}. Aguarde um minuto e tente novamente.`, HttpStatus.TOO_MANY_REQUESTS);
  }
  bucket.push(now);
  hits.set(bucketKey, bucket);
}
