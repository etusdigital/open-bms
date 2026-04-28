import { describe, it, expect } from 'vitest';
import { tagFormSchema, TAG_NAME_MAX, TAG_DESCRIPTION_MAX } from '../tag-schema';

describe('tagFormSchema', () => {
  it('accepts valid tag data', () => {
    const result = tagFormSchema.safeParse({
      name: 'My Tag',
      description: 'A description',
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'My Tag', description: 'A description' });
  });

  it('requires name to be non-empty', () => {
    const result = tagFormSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['name']);
    }
  });

  it(`rejects name longer than ${TAG_NAME_MAX} characters`, () => {
    const result = tagFormSchema.safeParse({ name: 'x'.repeat(TAG_NAME_MAX + 1) });
    expect(result.success).toBe(false);
  });

  it(`accepts name at exactly ${TAG_NAME_MAX} characters`, () => {
    const result = tagFormSchema.safeParse({ name: 'x'.repeat(TAG_NAME_MAX) });
    expect(result.success).toBe(true);
  });

  it('defaults description to empty string when omitted', () => {
    const result = tagFormSchema.safeParse({ name: 'Tag' });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe('');
  });

  it(`rejects description longer than ${TAG_DESCRIPTION_MAX} characters`, () => {
    const result = tagFormSchema.safeParse({
      name: 'Tag',
      description: 'x'.repeat(TAG_DESCRIPTION_MAX + 1),
    });
    expect(result.success).toBe(false);
  });

  it('exports max length constants', () => {
    expect(TAG_NAME_MAX).toBe(40);
    expect(TAG_DESCRIPTION_MAX).toBe(500);
  });
});
