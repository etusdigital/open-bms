import { NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';

describe('ContactsService', () => {
  describe('deleteOne', () => {
    const accountId = 42;

    function buildService(repoOverrides: Partial<{ findOne: jest.Mock; delete: jest.Mock }> = {}) {
      const contactRepository = {
        findOne: jest.fn(),
        delete: jest.fn(),
        ...repoOverrides,
      };
      const cls = { get: jest.fn().mockReturnValue(accountId) };
      const service = Object.create(ContactsService.prototype) as ContactsService;
      (service as any).contactRepository = contactRepository;
      (service as any).cls = cls;
      (service as any).logger = { error: jest.fn() };
      return { service, contactRepository, cls };
    }

    it('hard-deletes when contact belongs to the account', async () => {
      const { service, contactRepository } = buildService({
        findOne: jest.fn().mockResolvedValue({ id: 7, accountId }),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      });

      await expect(service.deleteOne(7)).resolves.toBeUndefined();

      expect(contactRepository.findOne).toHaveBeenCalledWith({ where: { id: 7, accountId } });
      expect(contactRepository.delete).toHaveBeenCalledWith({ id: 7, accountId });
    });

    it('throws NotFoundException when contact does not exist or belongs to another account', async () => {
      const { service, contactRepository } = buildService({
        findOne: jest.fn().mockResolvedValue(null),
      });

      await expect(service.deleteOne(7)).rejects.toBeInstanceOf(NotFoundException);
      expect(contactRepository.delete).not.toHaveBeenCalled();
    });
  });

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
