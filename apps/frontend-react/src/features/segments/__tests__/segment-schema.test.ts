import { describe, it, expect } from 'vitest';
import { segmentFormSchema } from '../segment-schema';

describe('segmentFormSchema', () => {
  it('accepts valid segment data', () => {
    const result = segmentFormSchema.safeParse({
      name: 'Active Users',
      description: 'Users active in last 30 days',
    });
    expect(result.success).toBe(true);
  });

  it('requires name', () => {
    const result = segmentFormSchema.safeParse({
      name: '',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('validation.required');
  });

  it('enforces name max length', () => {
    const result = segmentFormSchema.safeParse({
      name: 'a'.repeat(41),
    });
    expect(result.success).toBe(false);
  });

  it('defaults optional fields', () => {
    const result = segmentFormSchema.safeParse({
      name: 'Test Segment',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('');
      expect(result.data.contactsLimit).toBeNull();
      expect(result.data.recurrence).toBe(24);
      expect(result.data.addBounced).toBe(false);
      expect(result.data.addUnsubscribed).toBe(false);
      expect(result.data.addInvalid).toBe(false);
      expect(result.data.isRealTimeSegment).toBe(false);
      expect(result.data.steps).toEqual([]);
    }
  });

  it('accepts custom recurrence', () => {
    const result = segmentFormSchema.safeParse({
      name: 'Test',
      recurrence: 48,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative contactsLimit', () => {
    const result = segmentFormSchema.safeParse({
      name: 'Test',
      contactsLimit: -1,
    });
    expect(result.success).toBe(false);
  });
});
