import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies the `X-Hub-Signature-256` header sent by Meta on Webhooks.
 *
 * The header has the format `sha256=<hex>` and is computed as
 * HMAC-SHA256 over the raw request body with the Meta App Secret as the key.
 */
export function verifyMetaSignature(rawBody: string | Buffer, signature: string | undefined | null, appSecret: string): boolean {
  if (!signature || !appSecret) return false;

  const prefix = 'sha256=';
  const sig = signature.startsWith(prefix) ? signature.slice(prefix.length) : signature;
  if (!/^[0-9a-fA-F]+$/.test(sig)) return false;

  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const expected = createHmac('sha256', appSecret).update(payload).digest('hex');

  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
}
