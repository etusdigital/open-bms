import { createHmac } from 'node:crypto';
import { verifyMetaSignature } from './signature';

describe('verifyMetaSignature', () => {
  const secret = 'super-secret';
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  const validSig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

  it('accepts a valid signature with sha256= prefix', () => {
    expect(verifyMetaSignature(body, validSig, secret)).toBe(true);
  });

  it('accepts a valid signature without prefix', () => {
    const sigNoPrefix = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyMetaSignature(body, sigNoPrefix, secret)).toBe(true);
  });

  it('rejects when signature is wrong', () => {
    const tampered = 'sha256=' + createHmac('sha256', 'other-secret').update(body).digest('hex');
    expect(verifyMetaSignature(body, tampered, secret)).toBe(false);
  });

  it('rejects when body differs', () => {
    expect(verifyMetaSignature('{"object":"changed"}', validSig, secret)).toBe(false);
  });

  it('rejects when signature is missing or empty', () => {
    expect(verifyMetaSignature(body, undefined, secret)).toBe(false);
    expect(verifyMetaSignature(body, '', secret)).toBe(false);
  });

  it('rejects when secret is empty', () => {
    expect(verifyMetaSignature(body, validSig, '')).toBe(false);
  });

  it('rejects non-hex signature', () => {
    expect(verifyMetaSignature(body, 'sha256=not-hex!!', secret)).toBe(false);
  });

  it('accepts Buffer raw body', () => {
    expect(verifyMetaSignature(Buffer.from(body, 'utf8'), validSig, secret)).toBe(true);
  });
});
