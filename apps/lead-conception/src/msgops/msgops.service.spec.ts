import { MsgopsService } from './msgops.service';
import { makeAccount, makeContact, makeSuppression, makeCustomField } from '../__mocks__/test-fixtures';

describe('MsgopsService', () => {
  let service: MsgopsService;

  const mockContactRepo = {
    findOne: jest.fn(),
    create: jest.fn((entity) => entity),
    save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    })),
  };

  const mockSuppressionRepo = {
    findOne: jest.fn(),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockCustomFieldsRepo = {
    find: jest.fn(),
  };

  const mockContactCustomFieldsRepo = {
    find: jest.fn(),
  };

  const mockContactDevicesRepo = {
    findOne: jest.fn(),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orUpdate: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ generatedMaps: [{ id: 1, type: 'web-push', createdAt: new Date() }] }),
    })),
  };

  const mockAccountConfigRepo = {
    findOne: jest.fn(),
  };

  const mockAccountApiKeyRepo = {
    findOne: jest.fn(),
  };

  const mockAccountRepo = {
    findOneBy: jest.fn(),
  };

  const mockLeadsRepo = {
    create: jest.fn((entity) => entity),
    save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
  };

  const mockClusterMessageRepo = {
    findOne: jest.fn(),
  };

  const mockContactTagRepo = {
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
  };

  const mockRedisService = {
    getOrThrow: jest.fn(() => mockRedisClient),
  };

  const mockEntityManager = {
    query: jest.fn().mockResolvedValue([]),
  };

  const mockDataSource = {
    query: jest.fn().mockResolvedValue([]),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new MsgopsService(
      mockContactRepo as any,
      mockSuppressionRepo as any,
      mockCustomFieldsRepo as any,
      mockContactCustomFieldsRepo as any,
      mockContactDevicesRepo as any,
      mockAccountConfigRepo as any,
      mockAccountApiKeyRepo as any,
      mockAccountRepo as any,
      mockLeadsRepo as any,
      mockClusterMessageRepo as any,
      mockContactTagRepo as any,
      mockRedisService as any,
      mockEntityManager as any,
      mockDataSource as any,
    );
  });

  describe('findAccountByApiKey', () => {
    it('should return cached account from Redis when available', async () => {
      const account = makeAccount();
      const serialized = JSON.stringify(account);
      mockRedisClient.get.mockResolvedValue(serialized);

      const result = await service.findAccountByApiKey('test-api-key');

      // Redis returns JSON-parsed object (dates as strings, no functions)
      expect(result).toEqual(JSON.parse(serialized));
      expect(mockAccountConfigRepo.findOne).not.toHaveBeenCalled();
    });

    it('should query database when Redis cache miss', async () => {
      const account = makeAccount();
      mockRedisClient.get.mockResolvedValue(null);
      mockAccountConfigRepo.findOne.mockResolvedValue({ accountId: 1, account });
      mockAccountRepo.findOneBy.mockResolvedValue(account);

      const result = await service.findAccountByApiKey('test-api-key');

      expect(result).toEqual(account);
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should return undefined when account config not found', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockAccountConfigRepo.findOne.mockResolvedValue(null);

      const result = await service.findAccountByApiKey('bad-key');

      expect(result).toBeUndefined();
    });
  });

  describe('findContactByEmail', () => {
    it('should return contact when found', async () => {
      const contact = makeContact();
      mockContactRepo.findOne.mockResolvedValue(contact);

      const result = await service.findContactByEmail('test@example.com', 1);

      expect(result).toEqual(contact);
      expect(mockContactRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com', accountId: 1 },
      });
    });

    it('should return null when not found', async () => {
      mockContactRepo.findOne.mockResolvedValue(null);

      const result = await service.findContactByEmail('notfound@example.com', 1);

      expect(result).toBeNull();
    });
  });

  describe('findContactByUuid', () => {
    it('should return contact when found', async () => {
      const contact = makeContact();
      mockContactRepo.findOne.mockResolvedValue(contact);

      const result = await service.findContactByUuid('test-uuid', 1);

      expect(result).toEqual(contact);
    });

    it('should return null when not found', async () => {
      mockContactRepo.findOne.mockResolvedValue(null);

      const result = await service.findContactByUuid('unknown', 1);

      expect(result).toBeNull();
    });
  });

  describe('findContactById', () => {
    it('should return contact when found', async () => {
      const contact = makeContact();
      mockContactRepo.findOne.mockResolvedValue(contact);

      const result = await service.findContactById(1, 1);

      expect(result).toEqual(contact);
    });

    it('should return null when not found', async () => {
      mockContactRepo.findOne.mockResolvedValue(null);

      const result = await service.findContactById(999, 1);

      expect(result).toBeNull();
    });
  });

  describe('findContactByDevice', () => {
    it('should return contact from device when found', async () => {
      const contact = makeContact();
      mockContactDevicesRepo.findOne.mockResolvedValue({ contact });

      const result = await service.findContactByDevice(['token1'], 1);

      expect(result).toEqual(contact);
    });

    it('should return undefined when device not found', async () => {
      mockContactDevicesRepo.findOne.mockResolvedValue(null);

      const result = await service.findContactByDevice(['unknown-token'], 1);

      expect(result).toBeUndefined();
    });
  });

  describe('deleteContact', () => {
    it('should delete contact devices and contact', async () => {
      await service.deleteContact(1, 1);

      expect(mockContactDevicesRepo.delete).toHaveBeenCalledWith({ contactId: 1, accountId: 1 });
      expect(mockContactRepo.delete).toHaveBeenCalledWith({ id: 1, accountId: 1 });
    });
  });

  describe('createContact', () => {
    it('should create and save a new contact', async () => {
      const newContact = { email: 'new@example.com', accountId: 1, isValid: true } as any;
      mockContactRepo.create.mockReturnValue(newContact);
      mockContactRepo.save.mockResolvedValue({ id: 5, ...newContact });

      const result = await service.createContact(newContact);

      expect(result).toHaveProperty('id', 5);
      expect(mockContactRepo.create).toHaveBeenCalledWith(newContact);
    });
  });

  describe('updateContact', () => {
    it('should update contact when there are changes', async () => {
      const contact = makeContact({ email: 'old@example.com' });
      const newContact = { email: 'new@example.com' } as any;

      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      mockContactRepo.createQueryBuilder.mockReturnValue(mockQb);
      mockContactRepo.create.mockReturnValue({ email: 'new@example.com' });

      const result = await service.updateContact(contact, newContact);

      expect(mockQb.execute).toHaveBeenCalled();
      expect(result).toEqual(contact);
    });

    it('should return contact unchanged when no changes detected', async () => {
      const contact = makeContact({ email: 'same@example.com' });
      const newContact = { email: 'same@example.com' } as any;

      const result = await service.updateContact(contact, newContact);

      expect(mockContactRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(result).toEqual(contact);
    });
  });

  describe('getChangesOnly', () => {
    it('should return only changed keys', () => {
      const original = { a: 1, b: 2, c: 3 };
      const updated = { a: 1, b: 5, d: 4 };

      const result = service.getChangesOnly(original, updated);

      expect(result).toEqual({ b: 5, d: 4 });
    });

    it('should return empty object when nothing changed', () => {
      const original = { a: 1, b: 2 };
      const updated = { a: 1, b: 2 };

      const result = service.getChangesOnly(original, updated);

      expect(result).toEqual({});
    });
  });

  describe('getCustomFields', () => {
    it('should find custom fields by names and accountId', async () => {
      const fields = [makeCustomField({ name: 'FIELD1' }), makeCustomField({ name: 'FIELD2', id: 2 })];
      mockCustomFieldsRepo.find.mockResolvedValue(fields);

      const result = await service.getCustomFields(['FIELD1', 'FIELD2'], 1);

      expect(result).toHaveLength(2);
      expect(mockCustomFieldsRepo.find).toHaveBeenCalledWith({
        where: { name: expect.anything(), accountId: 1 },
      });
    });
  });

  describe('getContactsCustomFields', () => {
    it('should find contact custom fields by contactId and accountId', async () => {
      mockContactCustomFieldsRepo.find.mockResolvedValue([{ customFieldId: 1, value: 'val' }]);

      const result = await service.getContactsCustomFields(10, 1);

      expect(result).toHaveLength(1);
      expect(mockContactCustomFieldsRepo.find).toHaveBeenCalledWith({
        where: { contactId: 10, accountId: 1 },
      });
    });
  });

  describe('createOrUpdateCustomFields', () => {
    it('should execute raw query via dataSource', async () => {
      const query = 'INSERT INTO contacts_custom_fields ...';
      await service.createOrUpdateCustomFields(query);

      expect(mockDataSource.query).toHaveBeenCalledWith(query);
    });
  });

  describe('createDevice', () => {
    it('should upsert contact devices', async () => {
      const devices = [{ accountId: 1, contactId: 1, token: 'tok1', type: 'web-push' }] as any;

      const result = await service.createDevice(devices);

      expect(result).toBeDefined();
      expect(mockContactDevicesRepo.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('createLead', () => {
    it('should create and save a new lead', async () => {
      const leadData = { contactId: 1, accountId: 1, email: 'test@example.com' } as any;
      mockLeadsRepo.create.mockReturnValue(leadData);
      mockLeadsRepo.save.mockResolvedValue({ id: 10, ...leadData });

      const result = await service.createLead(leadData);

      expect(result).toHaveProperty('id', 10);
      expect(mockLeadsRepo.create).toHaveBeenCalledWith(leadData);
    });
  });

  describe('deleteContactTag', () => {
    it('should delete contact tags by contactId and accountId', async () => {
      await service.deleteContactTag(10, 1);

      expect(mockContactTagRepo.delete).toHaveBeenCalledWith({ contactId: 10, accountId: 1 });
    });
  });

  describe('removeSuppression', () => {
    it('should delete suppression by email and groupId', async () => {
      await service.removeSuppression('test@example.com', 100);

      expect(mockSuppressionRepo.delete).toHaveBeenCalledWith({ email: 'test@example.com', groupId: 100 });
    });
  });

  describe('findSuppressionByEmail', () => {
    it('should return suppression when found', async () => {
      const suppression = makeSuppression();
      mockSuppressionRepo.findOne.mockResolvedValue(suppression);

      const result = await service.findSuppressionByEmail('test@example.com', 100);

      expect(result).toEqual(suppression);
    });

    it('should return null when not found', async () => {
      mockSuppressionRepo.findOne.mockResolvedValue(null);

      const result = await service.findSuppressionByEmail('notfound@example.com', 100);

      expect(result).toBeNull();
    });
  });

  describe('eventLogResubscribed', () => {
    it('should execute INSERT query for event log', async () => {
      const eventLog = {
        currentDate: '01/01/2024',
        accountId: 1,
        contactId: 10,
        email: 'test@example.com',
        event: 'resubscribed',
        reason: 'api request',
        url: 'https://example.com',
        ip: '192.168.1.1',
        country: 'BR',
        region: 'SP',
        city: 'Sao Paulo',
      };

      await service.eventLogResubscribed(eventLog);

      expect(mockEntityManager.query).toHaveBeenCalled();
      const queryArg = mockEntityManager.query.mock.calls[0][0];
      expect(queryArg).toContain('INSERT INTO events_logs');
      expect(queryArg).toContain('test@example.com');
    });

    it('should handle null ip/country/region/city', async () => {
      const eventLog = {
        currentDate: '01/01/2024',
        accountId: 1,
        contactId: 10,
        email: 'test@example.com',
        event: 'resubscribed',
        reason: 'api request',
        url: 'https://example.com',
        ip: null,
        country: null,
        region: null,
        city: null,
      };

      await service.eventLogResubscribed(eventLog);

      const queryArg = mockEntityManager.query.mock.calls[0][0];
      expect(queryArg).toContain('null');
    });
  });

  describe('findClusterMessage', () => {
    it('should find cluster message by options', async () => {
      const spyConsole = jest.spyOn(console, 'log').mockImplementation();
      const message = { id: 1, message_id: 100 };
      mockClusterMessageRepo.findOne.mockResolvedValue(message);

      const result = await service.findClusterMessage({ location: 'SP' });

      expect(result).toEqual(message);
      spyConsole.mockRestore();
    });

    it('should return null when no cluster message found', async () => {
      const spyConsole = jest.spyOn(console, 'log').mockImplementation();
      mockClusterMessageRepo.findOne.mockResolvedValue(null);

      const result = await service.findClusterMessage({ location: 'XX' });

      expect(result).toBeNull();
      spyConsole.mockRestore();
    });
  });
});
