import { describe, it, expect } from 'vitest';
import { contactEditSchema } from '../contact-schema';

describe('contactEditSchema', () => {
  it('accepts valid contact data', () => {
    const result = contactEditSchema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+5511999999999',
      city: 'São Paulo',
      region: 'SP',
      country: 'Brazil',
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it('requires valid email', () => {
    const result = contactEditSchema.safeParse({
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('defaults optional fields', () => {
    const result = contactEditSchema.safeParse({
      email: 'test@example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe('');
      expect(result.data.lastName).toBe('');
      expect(result.data.isActive).toBe(true);
    }
  });

  it('enforces name max length', () => {
    const result = contactEditSchema.safeParse({
      email: 'test@example.com',
      firstName: 'a'.repeat(41),
    });
    expect(result.success).toBe(false);
  });
});
