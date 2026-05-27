import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies the HMAC-SHA256 signature sent by EvoHub on webhooks.
 *
 * The Hub signs each delivery with `EVOLUTION_HUB_WEBHOOK_SECRET` over the
 * raw request body. The signature is hex-encoded, optionally prefixed by
 * `sha256=` (we accept both forms to match the Hub's evolving header style).
 */
export function verifyHubSignature(rawBody: string | Buffer, signature: string | undefined | null, secret: string): boolean {
  if (!signature || !secret) return false;

  const prefix = 'sha256=';
  const sig = signature.startsWith(prefix) ? signature.slice(prefix.length) : signature;
  if (!/^[0-9a-fA-F]+$/.test(sig)) return false;

  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
}
