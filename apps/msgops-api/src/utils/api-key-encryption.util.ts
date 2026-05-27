import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM with a random 12-byte IV per value. Output: base64 of
// `iv | authTag | ciphertext` (no separator — fixed sizes: 12 + 16 = 28 header
// bytes, rest is ciphertext). GCM provides native integrity: if the ciphertext
// is tampered with, decipher.final() throws. Key is base64 in the env (32 raw bytes).
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

const ENV_VAR = 'ENTERPRISE_IMPORT_ENCRYPTION_KEY';

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env[ENV_VAR];
  if (!raw) {
    throw new Error(`${ENV_VAR} not set — gere com \`openssl rand -base64 32\` e adicione ao .env`);
  }

  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch (err: any) {
    throw new Error(`${ENV_VAR} must be valid base64: ${err?.message ?? 'parse error'}`, { cause: err });
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error(`${ENV_VAR} must decode to ${KEY_LENGTH} bytes (got ${key.length}). Regenere com \`openssl rand -base64 32\``);
  }

  cachedKey = key;
  return key;
}

export function encryptApiKey(plain: string): string {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('encryptApiKey: plain must be a non-empty string');
  }
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptApiKey(payload: string): string {
  if (typeof payload !== 'string' || payload.length === 0) {
    throw new Error('decryptApiKey: payload must be a non-empty string');
  }
  const key = loadKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('decryptApiKey: payload too short (corrupt or wrong key)');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

// Visible for tests — drops the cached key so a test can change the env var
// mid-run.
export function _resetEncryptionKeyCache(): void {
  cachedKey = null;
}
