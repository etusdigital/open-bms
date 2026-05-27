import { createHmac } from 'node:crypto';
import { verifyHubSignature } from './signature';

describe('verifyHubSignature', () => {
  const secret = 'hub-secret';
  const body = JSON.stringify({ event: 'channel_connected', data: { id: 'ch_1' } });
  const validSig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

  it('accepts a valid signature with sha256= prefix', () => {
    expect(verifyHubSignature(body, validSig, secret)).toBe(true);
  });

  it('accepts a valid signature without prefix', () => {
    const sigNoPrefix = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyHubSignature(body, sigNoPrefix, secret)).toBe(true);
  });

  it('rejects wrong secret', () => {
    const tampered = 'sha256=' + createHmac('sha256', 'other').update(body).digest('hex');
    expect(verifyHubSignature(body, tampered, secret)).toBe(false);
  });

  it('rejects tampered body', () => {
    expect(verifyHubSignature(body + 'tampered', validSig, secret)).toBe(false);
  });

  it('rejects empty/missing signature or secret', () => {
    expect(verifyHubSignature(body, undefined, secret)).toBe(false);
    expect(verifyHubSignature(body, '', secret)).toBe(false);
    expect(verifyHubSignature(body, validSig, '')).toBe(false);
  });
});
