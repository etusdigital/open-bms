import { HttpException, NotFoundException } from '@nestjs/common';
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

  describe('findContactHistory', () => {
    const accountId = 42;
    const contactId = 7;

    function buildService(
      overrides: {
        runQuery?: jest.Mock;
        managerQuery?: jest.Mock;
      } = {},
    ) {
      const clickhouseProvider = { runQuery: overrides.runQuery ?? jest.fn().mockResolvedValue([]) };
      const contactRepository = {
        manager: { query: overrides.managerQuery ?? jest.fn().mockResolvedValue([]) },
      };
      const cls = { get: jest.fn().mockReturnValue(accountId) };
      const service = Object.create(ContactsService.prototype) as ContactsService;
      (service as any).clickhouseProvider = clickhouseProvider;
      (service as any).contactRepository = contactRepository;
      (service as any).cls = cls;
      (service as any).logger = { warn: jest.fn(), error: jest.fn() };
      return { service, clickhouseProvider, contactRepository };
    }

    const baseParams = { page: 1, itemsPerPage: 10 } as any;

    it('reads message events from ClickHouse and hydrates the title from Postgres', async () => {
      const runQuery = jest.fn().mockResolvedValue([{ message_type: 'email', message_id: 5, event_id: 0, event: 'open', time: '2026-05-22 14:42:50.539', contact_id: contactId }]);
      const managerQuery = jest.fn().mockResolvedValue([{ id: 5, title: 'Welcome', type: 'email' }]);
      const { service } = buildService({ runQuery, managerQuery });

      const result = await service.findContactHistory(contactId, { ...baseParams, activities: ['message'] });

      expect(runQuery).toHaveBeenCalledWith(expect.stringContaining('events_logs_v2'));
      expect(managerQuery).toHaveBeenCalledWith(expect.stringContaining('FROM messages'), [[5]]);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        type: 'message',
        message_title: 'Welcome',
        message_type: 'email',
        time: '2026-05-22T14:42:50.539Z',
      });
    });

    it('hydrates custom_event name and properties from Postgres', async () => {
      const runQuery = jest
        .fn()
        .mockResolvedValue([{ message_type: 'custom_events', message_id: 0, event_id: 9, event: 'signup', time: '2026-05-22 10:00:00.000', contact_id: contactId }]);
      const managerQuery = jest.fn().mockResolvedValue([{ id: 9, name: 'Signup', properties: { plan: 'pro' } }]);
      const { service } = buildService({ runQuery, managerQuery });

      const result = await service.findContactHistory(contactId, { ...baseParams, activities: ['custom_event'] });

      expect(managerQuery).toHaveBeenCalledWith(expect.stringContaining('FROM custom_events'), [[9]]);
      expect(result.results[0]).toMatchObject({
        type: 'custom_event',
        message_title: 'Signup',
        event_properties: { plan: 'pro' },
      });
    });

    it('falls back to the message type when ClickHouse message_type is blank', async () => {
      const runQuery = jest.fn().mockResolvedValue([{ message_type: '', message_id: 5, event_id: 0, event: 'sent', time: '2026-05-22 09:00:00.000', contact_id: contactId }]);
      const managerQuery = jest.fn().mockResolvedValue([{ id: 5, title: 'Promo', type: 'sms' }]);
      const { service } = buildService({ runQuery, managerQuery });

      const result = await service.findContactHistory(contactId, { ...baseParams, activities: ['message'] });

      expect(result.results[0].message_type).toBe('sms');
    });

    it('applies the channel filter in the ClickHouse query (mapping wpp → whatsapp)', async () => {
      const runQuery = jest.fn().mockResolvedValue([]);
      const { service } = buildService({ runQuery });

      await service.findContactHistory(contactId, { ...baseParams, activities: ['message'], channels: ['email', 'wpp'] });

      expect(runQuery).toHaveBeenCalledWith(expect.stringContaining("message_type IN ('email', 'whatsapp')"));
    });

    it('applies the activity-type filter in the ClickHouse query', async () => {
      const runQuery = jest.fn().mockResolvedValue([]);
      const { service } = buildService({ runQuery });

      await service.findContactHistory(contactId, { ...baseParams, activities: ['custom_event'] });

      expect(runQuery).toHaveBeenCalledWith(expect.stringContaining("message_type = 'custom_events'"));
    });

    it('propagates a ClickHouse failure instead of masking it as an empty history', async () => {
      const runQuery = jest.fn().mockRejectedValue(new Error('ClickHouse unreachable'));
      const { service } = buildService({ runQuery });

      await expect(service.findContactHistory(contactId, { ...baseParams, activities: ['message'] })).rejects.toBeInstanceOf(HttpException);
    });
  });
});
