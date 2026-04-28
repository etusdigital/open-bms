// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import '@/lib/i18n';
import { labelFormSchema, LABEL_NAME_MAX, LABEL_DESCRIPTION_MAX } from '../label-schema';

describe('labelFormSchema', () => {
  it('accepts valid data', () => {
    const result = labelFormSchema.safeParse({ name: 'My Label', description: 'A description' });
    expect(result.success).toBe(true);
  });

  it('requires name', () => {
    const result = labelFormSchema.safeParse({ name: '', description: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name exceeding max length', () => {
    const result = labelFormSchema.safeParse({
      name: 'a'.repeat(LABEL_NAME_MAX + 1),
      description: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts name at max length', () => {
    const result = labelFormSchema.safeParse({
      name: 'a'.repeat(LABEL_NAME_MAX),
      description: '',
    });
    expect(result.success).toBe(true);
  });

  it('defaults description to empty string', () => {
    const result = labelFormSchema.safeParse({ name: 'Label' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('');
    }
  });

  it('rejects description exceeding max length', () => {
    const result = labelFormSchema.safeParse({
      name: 'Label',
      description: 'a'.repeat(LABEL_DESCRIPTION_MAX + 1),
    });
    expect(result.success).toBe(false);
  });

  it('exports correct max length constants', () => {
    expect(LABEL_NAME_MAX).toBe(100);
    expect(LABEL_DESCRIPTION_MAX).toBe(255);
  });
});
