import { ContactsService } from './contacts.service';

describe('ContactsService', () => {
  describe('isUuid', () => {
    // Access private method for testing
    const isUuid = (value: string) => (ContactsService.prototype as any).isUuid.call(null, value);

    it('should match UUID v4', () => {
      expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should match UUID v7', () => {
      expect(isUuid('01936b2a-7c5d-7f8e-b1a2-3c4d5e6f7890')).toBe(true);
    });

    it('should match legacy SHA-1 hash (40 hex chars)', () => {
      expect(isUuid('da39a3ee5e6b4b0d3255bfef95601890afd80709')).toBe(true);
    });

    it('should not match numeric IDs', () => {
      expect(isUuid('12345')).toBe(false);
      expect(isUuid('1')).toBe(false);
      expect(isUuid('999999999')).toBe(false);
    });

    it('should not match partial UUIDs', () => {
      expect(isUuid('550e8400-e29b-41d4')).toBe(false);
    });

    it('should not match invalid hex strings', () => {
      expect(isUuid('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
      expect(isUuid('DA39A3EE5E6B4B0D3255BFEF95601890AFD80709')).toBe(true);
    });
  });
});
