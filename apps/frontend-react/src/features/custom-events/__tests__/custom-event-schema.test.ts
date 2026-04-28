// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import '@/lib/i18n';
import { customEventFormSchema, CUSTOM_EVENT_NAME_MAX, CUSTOM_EVENT_DESCRIPTION_MAX } from '../custom-event-schema';

describe('customEventFormSchema', () => {
  it('accepts valid data', () => {
    const result = customEventFormSchema.safeParse({
      name: 'page_view',
      description: 'Page viewed',
    });
    expect(result.success).toBe(true);
  });

  it('requires name', () => {
    const result = customEventFormSchema.safeParse({ name: '', description: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name exceeding max length', () => {
    const result = customEventFormSchema.safeParse({
      name: 'a'.repeat(CUSTOM_EVENT_NAME_MAX + 1),
      description: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts name at max length', () => {
    const result = customEventFormSchema.safeParse({
      name: 'a'.repeat(CUSTOM_EVENT_NAME_MAX),
      description: '',
    });
    expect(result.success).toBe(true);
  });

  it('defaults description to empty string', () => {
    const result = customEventFormSchema.safeParse({ name: 'event' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('');
    }
  });

  it('rejects description exceeding max length', () => {
    const result = customEventFormSchema.safeParse({
      name: 'event',
      description: 'a'.repeat(CUSTOM_EVENT_DESCRIPTION_MAX + 1),
    });
    expect(result.success).toBe(false);
  });

  it('exports correct max length constants', () => {
    expect(CUSTOM_EVENT_NAME_MAX).toBe(40);
    expect(CUSTOM_EVENT_DESCRIPTION_MAX).toBe(500);
  });
});
