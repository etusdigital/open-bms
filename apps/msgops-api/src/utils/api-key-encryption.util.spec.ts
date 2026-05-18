import { randomBytes } from 'node:crypto';
import { encryptApiKey, decryptApiKey, _resetEncryptionKeyCache } from './api-key-encryption.util';

describe('api-key-encryption', () => {
  const originalKey = process.env.ENTERPRISE_IMPORT_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENTERPRISE_IMPORT_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    _resetEncryptionKeyCache();
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.ENTERPRISE_IMPORT_ENCRYPTION_KEY;
    else process.env.ENTERPRISE_IMPORT_ENCRYPTION_KEY = originalKey;
    _resetEncryptionKeyCache();
  });

  it('roundtrips plain text through encrypt/decrypt', () => {
    const plain = 'sk_live_abc123XYZ_$@';
    const cipher = encryptApiKey(plain);
    expect(cipher).not.toContain(plain);
    expect(decryptApiKey(cipher)).toBe(plain);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const plain = 'same-key';
    const a = encryptApiKey(plain);
    const b = encryptApiKey(plain);
    expect(a).not.toBe(b);
    expect(decryptApiKey(a)).toBe(plain);
    expect(decryptApiKey(b)).toBe(plain);
  });

  it('throws when ciphertext is tampered (GCM auth tag mismatch)', () => {
    const cipher = encryptApiKey('original');
    const buf = Buffer.from(cipher, 'base64');
    buf[buf.length - 1] = buf[buf.length - 1] ^ 0xff;
    const tampered = buf.toString('base64');
    expect(() => decryptApiKey(tampered)).toThrow();
  });

  it('throws on empty input', () => {
    expect(() => encryptApiKey('')).toThrow();
    expect(() => decryptApiKey('')).toThrow();
  });

  it('throws when env var is missing', () => {
    const saved = process.env.ENTERPRISE_IMPORT_ENCRYPTION_KEY;
    delete process.env.ENTERPRISE_IMPORT_ENCRYPTION_KEY;
    _resetEncryptionKeyCache();
    expect(() => encryptApiKey('x')).toThrow(/ENTERPRISE_IMPORT_ENCRYPTION_KEY/);
    process.env.ENTERPRISE_IMPORT_ENCRYPTION_KEY = saved;
    _resetEncryptionKeyCache();
  });

  it('throws when env var is wrong length', () => {
    const saved = process.env.ENTERPRISE_IMPORT_ENCRYPTION_KEY;
    process.env.ENTERPRISE_IMPORT_ENCRYPTION_KEY = Buffer.from('too-short').toString('base64');
    _resetEncryptionKeyCache();
    expect(() => encryptApiKey('x')).toThrow(/32 bytes/);
    process.env.ENTERPRISE_IMPORT_ENCRYPTION_KEY = saved;
    _resetEncryptionKeyCache();
  });
});
