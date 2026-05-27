import { describe, it, expect } from 'vitest';
import {
  customFieldFormSchema,
  CUSTOM_FIELD_TITLE_MAX,
  CUSTOM_FIELD_DESCRIPTION_MAX,
  CUSTOM_FIELD_TYPES,
} from '../custom-field-schema';

describe('customFieldFormSchema', () => {
  it('accepts valid custom field data', () => {
    const result = customFieldFormSchema.safeParse({
      title: 'Preferred Color',
      description: 'Customer favorite color',
      type: 'text',
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      title: 'Preferred Color',
      description: 'Customer favorite color',
      type: 'text',
    });
  });

  it('requires title to be non-empty', () => {
    const result = customFieldFormSchema.safeParse({ title: '', type: 'text' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['title']);
    }
  });

  it(`rejects title longer than ${CUSTOM_FIELD_TITLE_MAX} characters`, () => {
    const result = customFieldFormSchema.safeParse({
      title: 'x'.repeat(CUSTOM_FIELD_TITLE_MAX + 1),
      type: 'text',
    });
    expect(result.success).toBe(false);
  });

  it(`accepts title at exactly ${CUSTOM_FIELD_TITLE_MAX} characters`, () => {
    const result = customFieldFormSchema.safeParse({
      title: 'x'.repeat(CUSTOM_FIELD_TITLE_MAX),
      type: 'text',
    });
    expect(result.success).toBe(true);
  });

  it('defaults description to empty string when omitted', () => {
    const result = customFieldFormSchema.safeParse({ title: 'Field', type: 'text' });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe('');
  });

  it(`rejects description longer than ${CUSTOM_FIELD_DESCRIPTION_MAX} characters`, () => {
    const result = customFieldFormSchema.safeParse({
      title: 'Field',
      type: 'text',
      description: 'x'.repeat(CUSTOM_FIELD_DESCRIPTION_MAX + 1),
    });
    expect(result.success).toBe(false);
  });

  it('requires type to be a valid enum value', () => {
    const result = customFieldFormSchema.safeParse({
      title: 'Field',
      type: 'invalid_type',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['type']);
    }
  });

  it('accepts all valid type values', () => {
    for (const type of CUSTOM_FIELD_TYPES) {
      const result = customFieldFormSchema.safeParse({ title: 'Field', type });
      expect(result.success).toBe(true);
    }
  });

  it('exports correct max length constants', () => {
    expect(CUSTOM_FIELD_TITLE_MAX).toBe(40);
    expect(CUSTOM_FIELD_DESCRIPTION_MAX).toBe(255);
  });

  it('exports the type enum values', () => {
    expect(CUSTOM_FIELD_TYPES).toEqual(['text', 'number', 'date', 'list', 'file']);
  });
});
