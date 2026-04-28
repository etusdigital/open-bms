import { describe, it, expect } from 'vitest';
import { warmupFormSchema } from '../warmup-schema';

describe('warmupFormSchema', () => {
  const validWarmup = {
    accountId: 1,
    targetAccountId: 2,
    sender: 'no-reply@example.com',
    ippool: 'main-pool',
    replyTo: 'reply@example.com',
    target: 1000,
    type: 'internal' as const,
    stage: 1,
    description: 'Test warmup',
  };

  it('accepts valid warmup data', () => {
    const result = warmupFormSchema.safeParse(validWarmup);
    expect(result.success).toBe(true);
  });

  it('requires accountId', () => {
    const result = warmupFormSchema.safeParse({
      ...validWarmup,
      accountId: 0,
    });
    expect(result.success).toBe(false);
  });

  it('requires targetAccountId', () => {
    const result = warmupFormSchema.safeParse({
      ...validWarmup,
      targetAccountId: 0,
    });
    expect(result.success).toBe(false);
  });

  it('requires sender', () => {
    const result = warmupFormSchema.safeParse({
      ...validWarmup,
      sender: '',
    });
    expect(result.success).toBe(false);
  });

  it('requires ippool', () => {
    const result = warmupFormSchema.safeParse({
      ...validWarmup,
      ippool: '',
    });
    expect(result.success).toBe(false);
  });

  it('requires target > 0', () => {
    const result = warmupFormSchema.safeParse({
      ...validWarmup,
      target: 0,
    });
    expect(result.success).toBe(false);
  });

  it('defaults type to internal', () => {
    const result = warmupFormSchema.safeParse({
      ...validWarmup,
      type: undefined,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('internal');
    }
  });

  it('allows null stage for external type', () => {
    const result = warmupFormSchema.safeParse({
      ...validWarmup,
      type: 'external',
      stage: null,
    });
    expect(result.success).toBe(true);
  });

  it('defaults description to empty string', () => {
    const result = warmupFormSchema.safeParse({
      ...validWarmup,
      description: undefined,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('');
    }
  });
});
