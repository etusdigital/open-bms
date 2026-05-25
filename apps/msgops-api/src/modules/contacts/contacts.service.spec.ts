import { HttpException, NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactEntity } from '../../entities/contact.entity';
import { ContactTagEntity } from '../../entities/contact-tag.entity';
import { TagEntity } from '../../entities/tag.entity';
import { ContactCustomFieldEntity } from '../../entities/contact-custom-field.entity';
import { CustomFieldsEntity } from '../../entities/custom-fields.entity';

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
        // ClickHouse event rows returned by the data query; the count query is
        // derived from this list automatically (count() => rows.length).
        rows?: any[];
        // Raw automation rows returned by the Postgres query builder.
        automations?: any[];
        runQuery?: jest.Mock;
        managerQuery?: jest.Mock;
      } = {},
    ) {
      const rows = overrides.rows ?? [];
      const runQuery = overrides.runQuery ?? jest.fn((sql: string) => Promise.resolve(/count\(\)/.test(sql) ? [{ total: rows.length }] : rows));
      const clickhouseProvider = { runQuery };
      const contactRepository = {
        manager: { query: overrides.managerQuery ?? jest.fn().mockResolvedValue([]) },
      };
      // Chainable query-builder stub for the Postgres automations branch.
      const automationsQb: any = {};
      for (const m of ['where', 'andWhere', 'select', 'orderBy', 'limit']) {
        automationsQb[m] = jest.fn().mockReturnValue(automationsQb);
      }
      automationsQb.getCount = jest.fn().mockResolvedValue((overrides.automations ?? []).length);
      automationsQb.getRawMany = jest.fn().mockResolvedValue(overrides.automations ?? []);
      const contactAutomationRepository = { createQueryBuilder: jest.fn().mockReturnValue(automationsQb) };
      const cls = { get: jest.fn().mockReturnValue(accountId) };
      const service = Object.create(ContactsService.prototype) as ContactsService;
      (service as any).clickhouseProvider = clickhouseProvider;
      (service as any).contactRepository = contactRepository;
      (service as any).contactAutomationRepository = contactAutomationRepository;
      (service as any).cls = cls;
      (service as any).logger = { warn: jest.fn(), error: jest.fn() };
      return { service, clickhouseProvider, contactRepository, runQuery };
    }

    const baseParams = { page: 1, itemsPerPage: 10 } as any;

    it('reads message events from ClickHouse and hydrates the title from Postgres', async () => {
      const managerQuery = jest.fn().mockResolvedValue([{ id: 5, title: 'Welcome', type: 'email' }]);
      const { service, runQuery } = buildService({
        rows: [{ message_type: 'email', message_id: 5, event_id: 0, event: 'open', time: '2026-05-22 14:42:50.539', contact_id: contactId }],
        managerQuery,
      });

      const result = await service.findContactHistory(contactId, { ...baseParams, activities: ['message'] });

      expect(runQuery).toHaveBeenCalledWith(expect.stringContaining('events_logs_v2'));
      expect(managerQuery).toHaveBeenCalledWith(expect.stringContaining('FROM messages'), [[5]]);
      expect(result.results).toHaveLength(1);
      expect(result.totalItems).toBe(1);
      expect(result.results[0]).toMatchObject({
        type: 'message',
        message_title: 'Welcome',
        message_type: 'email',
        time: '2026-05-22T14:42:50.539Z',
      });
    });

    it('falls back to the message type when ClickHouse message_type is blank', async () => {
      const managerQuery = jest.fn().mockResolvedValue([{ id: 5, title: 'Promo', type: 'sms' }]);
      const { service } = buildService({
        rows: [{ message_type: '', message_id: 5, event_id: 0, event: 'sent', time: '2026-05-22 09:00:00.000', contact_id: contactId }],
        managerQuery,
      });

      const result = await service.findContactHistory(contactId, { ...baseParams, activities: ['message'] });

      expect(result.results[0].message_type).toBe('sms');
    });

    it('applies the channel filter in the ClickHouse query (mapping wpp → whatsapp)', async () => {
      const { service, runQuery } = buildService();

      await service.findContactHistory(contactId, { ...baseParams, activities: ['message'], channels: ['email', 'wpp'] });

      expect(runQuery).toHaveBeenCalledWith(expect.stringContaining("message_type IN ('email', 'whatsapp')"));
    });

    it('reports the overall match count and caps a page at itemsPerPage', async () => {
      // 25 events match; page 1 of 10 must return 10 rows but total = 25.
      const rows = Array.from({ length: 25 }, (_, i) => ({
        message_type: 'email',
        message_id: 0,
        event_id: 0,
        event: 'open',
        time: `2026-05-22 10:00:${String(i).padStart(2, '0')}.000`,
        contact_id: contactId,
      }));
      const { service } = buildService({ rows });

      const result = await service.findContactHistory(contactId, { page: 1, itemsPerPage: 10, activities: ['message'] } as any);

      expect(result.totalItems).toBe(25);
      expect(result.results).toHaveLength(10);
      // Newest first.
      expect(result.results[0].time > result.results[9].time).toBe(true);
    });

    it('interleaves automations and events into a single timeline ordered by recency', async () => {
      const { service } = buildService({
        automations: [{ type: 'automation', created_at: '2026-05-22T12:00:00.000Z', automation_id: 1 }],
        rows: [
          { message_type: 'email', message_id: 0, event_id: 0, event: 'open', time: '2026-05-22 14:00:00.000', contact_id: contactId },
          { message_type: 'email', message_id: 0, event_id: 0, event: 'sent', time: '2026-05-22 09:00:00.000', contact_id: contactId },
        ],
      });

      const result = await service.findContactHistory(contactId, { page: 1, itemsPerPage: 10 } as any);

      expect(result.totalItems).toBe(3);
      expect(result.results.map((r: any) => r.type)).toEqual(['message', 'automation', 'message']);
      expect(result.results[1]).toMatchObject({ type: 'automation', automation_id: 1 });
    });

    it('propagates a ClickHouse failure instead of masking it as an empty history', async () => {
      const runQuery = jest.fn().mockRejectedValue(new Error('ClickHouse unreachable'));
      const { service } = buildService({ runQuery });

      await expect(service.findContactHistory(contactId, { ...baseParams, activities: ['message'] })).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('findByProperty', () => {
    const accountId = 42;

    function buildService(getOneResult: any = null) {
      const qb = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(getOneResult),
      };
      const contactRepository = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
      const cls = { get: jest.fn().mockReturnValue(accountId) };
      const service = Object.create(ContactsService.prototype) as ContactsService;
      (service as any).contactRepository = contactRepository;
      (service as any).cls = cls;
      return { service, contactRepository, qb };
    }

    it('returns null without touching the database when no identifier is given', async () => {
      const { service, contactRepository } = buildService();

      await expect(service.findByProperty({})).resolves.toBeNull();
      expect(contactRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('queries the contact when an email is given', async () => {
      const { service, qb } = buildService({ id: 7 });

      const result = await service.findByProperty({ email: 'A@B.com' });

      expect(qb.where).toHaveBeenCalledWith(expect.objectContaining({ accountId, email: 'a@b.com' }));
      expect(result).toEqual({ id: 7 });
    });
  });

  describe('resolveTagsByName', () => {
    const accountId = 42;

    function buildService(tagRows: any[]) {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(tagRows),
      };
      const tagRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
      const manager = { getRepository: jest.fn().mockReturnValue(tagRepo) };
      const service = Object.create(ContactsService.prototype) as ContactsService;
      return { service, manager, qb };
    }

    const resolve = (service: ContactsService, names: string[], manager: any) => (service as any).resolveTagsByName(names, accountId, manager) as Promise<any[]>;

    it('returns [] for empty names without querying', async () => {
      const { service, manager } = buildService([]);

      await expect(resolve(service, [], manager)).resolves.toEqual([]);
      expect(manager.getRepository).not.toHaveBeenCalled();
    });

    it('returns the resolved tag entities when every name matches', async () => {
      const { service, manager } = buildService([{ id: 9, name: 'api-contact' }]);

      await expect(resolve(service, ['api-contact'], manager)).resolves.toEqual([{ id: 9, name: 'api-contact' }]);
    });

    it('matches case-insensitively (segment tags keep their original casing)', async () => {
      // Stored tag name is mixed-case; the request passes a different casing.
      const { service, manager, qb } = buildService([{ id: 3, name: 'Segmento1' }]);

      await expect(resolve(service, ['SEGMENTO1'], manager)).resolves.toHaveLength(1);
      expect(qb.andWhere).toHaveBeenCalledWith('LOWER(tag.name) IN (:...names)', { names: ['segmento1'] });
    });

    it('throws NotFoundException when a name does not resolve', async () => {
      const { service, manager } = buildService([]);

      await expect(resolve(service, ['missing'], manager)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create with tagNames', () => {
    const accountId = 42;

    function buildService({ insertedTagIds, tagRows, customFieldDefs }: { insertedTagIds?: number[]; tagRows?: any[]; customFieldDefs?: any[] } = {}) {
      const tagQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(tagRows ?? [{ id: 9, name: 'api-contact' }]),
      };
      const tagRepo = { createQueryBuilder: jest.fn().mockReturnValue(tagQb) };
      const savedContact = { id: 7, email: 'a@b.com', uuid: 'u' };
      const contactRepo = {
        create: jest.fn((entity) => entity),
        save: jest.fn().mockResolvedValue(savedContact),
      };
      // contacts_tags query builder — insert chain with ON CONFLICT DO NOTHING
      // (orIgnore) and RETURNING tag_id. `raw` holds rows that actually landed.
      const rawReturning = (insertedTagIds ?? [9]).map((id) => ({ tag_id: id }));
      const ctQb = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw: rawReturning }),
      };
      const ctRepo = { createQueryBuilder: jest.fn().mockReturnValue(ctQb) };
      // custom_fields lookup
      const cfDefsQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(customFieldDefs ?? []),
      };
      const cfDefsRepo = { createQueryBuilder: jest.fn().mockReturnValue(cfDefsQb) };
      // contacts_custom_fields upsert
      const ccfQb = {
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orUpdate: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      const ccfRepo = { createQueryBuilder: jest.fn().mockReturnValue(ccfQb) };
      const manager = {
        getRepository: jest.fn((entity: any) => {
          if (entity === TagEntity) return tagRepo;
          if (entity === ContactEntity) return contactRepo;
          if (entity === ContactTagEntity) return ctRepo;
          if (entity === CustomFieldsEntity) return cfDefsRepo;
          if (entity === ContactCustomFieldEntity) return ccfRepo;
          throw new Error(`unexpected entity in test: ${entity}`);
        }),
      };
      const transaction = jest.fn((cb: any) => cb(manager));
      const contactRepository = { manager: { transaction } };
      const cls = { get: jest.fn().mockReturnValue(accountId) };
      const service = Object.create(ContactsService.prototype) as ContactsService;
      (service as any).contactRepository = contactRepository;
      (service as any).cls = cls;
      (service as any).logger = { error: jest.fn(), warn: jest.fn() };
      const publishTagEvents = jest.fn().mockResolvedValue(undefined);
      (service as any).publishTagEvents = publishTagEvents;
      (service as any).buildTagEventPairs = jest.fn().mockResolvedValue([{ contact: { id: 7 }, tagName: 'api-contact' }]);
      return { service, contactRepo, ctQb, ccfQb, cfDefsQb, publishTagEvents };
    }

    it('AC1: creates the contact, links the tag, publishes an add event', async () => {
      const { service, ctQb, publishTagEvents } = buildService();

      const result = await service.create({ email: 'a@b.com', tagNames: ['api-contact'] } as any);

      expect(ctQb.values).toHaveBeenCalledWith([{ contactId: 7, tagId: 9, accountId }]);
      expect(ctQb.execute).toHaveBeenCalled();
      expect(publishTagEvents).toHaveBeenCalledWith('add', accountId, expect.anything());
      expect(result).toMatchObject({ id: 7 });
    });

    it('AC3: without tagNames behaves as before — no tag link, no event', async () => {
      const { service, ctQb, publishTagEvents } = buildService();

      await service.create({ email: 'a@b.com' } as any);

      expect(ctQb.values).not.toHaveBeenCalled();
      expect(publishTagEvents).not.toHaveBeenCalled();
    });

    it('AC4: tag already linked — ON CONFLICT skips the insert, no redundant event', async () => {
      // The unique constraint catches the conflict; RETURNING comes back empty.
      const { service, ctQb, publishTagEvents } = buildService({ insertedTagIds: [] });

      await service.create({ email: 'a@b.com', tagNames: ['api-contact'] } as any);

      expect(ctQb.execute).toHaveBeenCalled();
      expect(publishTagEvents).not.toHaveBeenCalled();
    });

    it('AC2: unknown tag name throws NotFoundException and persists nothing', async () => {
      const { service, contactRepo, publishTagEvents } = buildService({ tagRows: [] });

      await expect(service.create({ email: 'a@b.com', tagNames: ['missing'] } as any)).rejects.toBeInstanceOf(NotFoundException);
      expect(contactRepo.save).not.toHaveBeenCalled();
      expect(publishTagEvents).not.toHaveBeenCalled();
    });

    it("AC5: singular `tagName` (Pet's envelope) normalizes to the same insert as the array form", async () => {
      const { service, ctQb, publishTagEvents } = buildService();

      await service.create({ email: 'a@b.com', tagName: 'api-contact' } as any);

      expect(ctQb.values).toHaveBeenCalledWith([{ contactId: 7, tagId: 9, accountId }]);
      expect(publishTagEvents).toHaveBeenCalledWith('add', accountId, expect.anything());
    });

    it('AC6: `tagName` + `tagNames` together dedupe to one insert', async () => {
      const { service, ctQb } = buildService();

      await service.create({ email: 'a@b.com', tagName: 'api-contact', tagNames: ['api-contact'] } as any);

      expect(ctQb.values).toHaveBeenCalledWith([{ contactId: 7, tagId: 9, accountId }]);
    });

    it('AC7: customFields resolve case-insensitively and upsert as (account, contact, custom_field) rows', async () => {
      const defs = [
        { id: 11, name: 'UTM_MEDIUM' },
        { id: 12, name: 'NEGATIVADO' },
      ];
      const { service, ccfQb, cfDefsQb } = buildService({ customFieldDefs: defs });

      await service.create({
        email: 'a@b.com',
        customFields: { utm_medium: 'cpc', negativado: 'nao' },
      } as any);

      // Lookup uses the canonical (uppercased) names.
      expect(cfDefsQb.andWhere).toHaveBeenCalledWith('cf.name IN (:...names)', { names: ['UTM_MEDIUM', 'NEGATIVADO'] });
      expect(ccfQb.values).toHaveBeenCalledWith([
        { accountId, contactId: 7, customFieldId: 11, value: 'cpc' },
        { accountId, contactId: 7, customFieldId: 12, value: 'nao' },
      ]);
      expect(ccfQb.orUpdate).toHaveBeenCalledWith(['value'], ['account_id', 'contact_id', 'custom_field_id']);
    });

    it('AC8: unknown custom field name throws NotFoundException and persists nothing', async () => {
      // Only UTM_MEDIUM is registered; the request also references an unknown key.
      const { service, contactRepo, ccfQb } = buildService({ customFieldDefs: [{ id: 11, name: 'UTM_MEDIUM' }] });

      await expect(
        service.create({
          email: 'a@b.com',
          customFields: { utm_medium: 'cpc', unknown_field: 'x' },
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);

      // Transaction rolled back — contact write must not have landed, no upsert either.
      expect(contactRepo.save).not.toHaveBeenCalled();
      expect(ccfQb.values).not.toHaveBeenCalled();
    });
  });
});
