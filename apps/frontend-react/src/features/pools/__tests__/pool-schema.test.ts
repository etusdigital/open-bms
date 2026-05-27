import { describe, it, expect } from 'vitest';
import { poolFormSchema } from '../pool-schema';

describe('poolFormSchema', () => {
  it('accepts valid pool data', () => {
    const result = poolFormSchema.safeParse({
      name: 'Main Pool',
      description: 'Primary sending pool',
      poolName: 'main-pool',
      isDefault: true,
      ip: '192.168.1.1',
    });
    expect(result.success).toBe(true);
  });

  it('requires name', () => {
    const result = poolFormSchema.safeParse({
      name: '',
      poolName: 'pool-1',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('validation.required');
  });

  it('enforces name max length', () => {
    const result = poolFormSchema.safeParse({
      name: 'a'.repeat(41),
      poolName: 'pool-1',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('validation.maxLength');
  });

  // SendGrid Free/Essentials plans have no dedicated IP pools, so we
  // intentionally allow saving without a pool selection — the worker
  // omits ip_pool_name from the SendGrid mail payload and falls back
  // to shared IPs.
  it('allows empty poolName (SendGrid plans without dedicated IP pools)', () => {
    const result = poolFormSchema.safeParse({
      name: 'Test Pool',
      poolName: '',
    });
    expect(result.success).toBe(true);
  });

  it('defaults optional fields', () => {
    const result = poolFormSchema.safeParse({
      name: 'Test Pool',
      poolName: 'pool-1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('');
      expect(result.data.isDefault).toBe(false);
    }
  });
});
