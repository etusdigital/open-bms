import { MsgopsService } from './msgops.service';
import {
  createAccount,
  createAutomation,
  createContact,
  createContactAutomation,
  createTag,
} from '../__mocks__/test-fixtures';
import { CustomFieldKeyType, Status } from '../interfaces';

describe('MsgopsService', () => {
  let service: MsgopsService;
  let mockRedisClient: any;
  let contactRepository: any;
  let contactConditionalRepository: any;
  let automationRepository: any;
  let contactAutomationRepository: any;
  let contactTagRepository: any;
  let tagRepository: any;
  let accountConfigRepository: any;
  let leadRepository: any;
  let accountRepository: any;
  let automationTargetRepository: any;
  let campaignRepository: any;
  let redisService: any;
  let entityManager: any;
  let trackerService: any;
  let clickhouseProvider: any;

  beforeEach(() => {
    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };

    const createMockQueryBuilder = (returnValue: any = null) => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(returnValue),
      getRawOne: jest.fn().mockResolvedValue(returnValue),
      getRawMany: jest.fn().mockResolvedValue(returnValue || []),
      getOne: jest.fn().mockResolvedValue(returnValue),
      getMany: jest.fn().mockResolvedValue(returnValue || []),
    });

    const createMockRepo = () => ({
      findOne: jest.fn(),
      find: jest.fn(),
      query: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      merge: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(createMockQueryBuilder()),
      manager: {
        connection: {
          createQueryRunner: jest.fn().mockReturnValue({
            connect: jest.fn().mockResolvedValue(undefined),
            startTransaction: jest.fn().mockResolvedValue(undefined),
            commitTransaction: jest.fn().mockResolvedValue(undefined),
            rollbackTransaction: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
            manager: {
              query: jest.fn().mockResolvedValue([]),
              delete: jest.fn().mockResolvedValue(undefined),
            },
          }),
        },
      },
    });

    contactRepository = createMockRepo();
    contactConditionalRepository = createMockRepo();
    automationRepository = createMockRepo();
    contactAutomationRepository = createMockRepo();
    contactTagRepository = createMockRepo();
    tagRepository = createMockRepo();
    accountConfigRepository = createMockRepo();
    leadRepository = createMockRepo();
    accountRepository = createMockRepo();
    automationTargetRepository = createMockRepo();
    campaignRepository = createMockRepo();

    redisService = {
      getOrThrow: jest.fn().mockReturnValue(mockRedisClient),
    };

    entityManager = {
      query: jest.fn().mockResolvedValue([]),
    };

    trackerService = {
      logInfo: jest.fn(),
    };

    clickhouseProvider = {
      runQuery: jest.fn().mockResolvedValue([]),
    };

    service = new MsgopsService(
      contactRepository,
      contactConditionalRepository,
      automationRepository,
      contactAutomationRepository,
      contactTagRepository,
      tagRepository,
      accountConfigRepository,
      leadRepository,
      accountRepository,
      automationTargetRepository,
      campaignRepository,
      redisService,
      entityManager,
      trackerService,
      clickhouseProvider,
    );
  });

  describe('findAccountByConfig', () => {
    it('should call accountConfigRepository.findOne with correct params', async () => {
      const expected = { account: createAccount() };
      accountConfigRepository.findOne.mockResolvedValue(expected);

      const result = await service.findAccountByConfig('api_key', 'test-key');

      expect(accountConfigRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'api_key', value: 'test-key' },
        }),
      );
      expect(result).toEqual(expected);
    });
  });

  describe('findAccount', () => {
    it('should return cached account from redis', async () => {
      const account = createAccount();
      const serialized = JSON.stringify(account);
      mockRedisClient.get.mockResolvedValue(serialized);

      const result = await service.findAccount(1);

      expect(result).toEqual(JSON.parse(serialized));
      expect(accountRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from db and cache when not in redis', async () => {
      const account = createAccount();
      mockRedisClient.get.mockResolvedValue(null);
      accountRepository.findOne.mockResolvedValue(account);

      const result = await service.findAccount(1);

      expect(result).toEqual(account);
      expect(mockRedisClient.set).toHaveBeenCalledWith('account:1', JSON.stringify(account));
    });
  });

  describe('findContactByEmail', () => {
    it('should call contactRepository.findOne with email and accountId', async () => {
      const contact = createContact();
      contactRepository.findOne.mockResolvedValue(contact);

      const result = await service.findContactByEmail('test@example.com', 1);

      expect(contactRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com', accountId: 1 },
      });
      expect(result).toEqual(contact);
    });

    it('should use default accountId of 0', async () => {
      contactRepository.findOne.mockResolvedValue(null);

      await service.findContactByEmail('test@example.com');

      expect(contactRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com', accountId: 0 },
      });
    });
  });

  describe('findContactByUuid', () => {
    it('should query by uuid and accountId', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ id: 1, email: 'test@test.com' }),
      };
      contactRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findContactByUuid('uuid-123', 1);

      expect(result).toEqual({ id: 1, email: 'test@test.com' });
    });
  });

  describe('findContactById', () => {
    it('should return null when no result', async () => {
      contactRepository.query.mockResolvedValue([]);
      const result = await service.findContactById(1, 1);
      expect(result).toBeUndefined();
    });

    it('should transform snake_case to camelCase and add fullName', async () => {
      contactRepository.query.mockResolvedValue([
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@test.com',
          custom_fields: null,
          contact_devices: null,
        },
      ]);

      const result = await service.findContactById(1, 1);

      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.fullName).toBe('John Doe');
      expect(result.contactDevices).toEqual([]);
    });

    it('should parse custom_fields into key-value object', async () => {
      contactRepository.query.mockResolvedValue([
        {
          id: 1,
          first_name: 'John',
          last_name: '',
          custom_fields: [{ name: 'company', value: 'Acme', customFieldId: 1 }],
          contact_devices: [{ id: 1 }],
        },
      ]);

      const result = await service.findContactById(1, 1);

      expect(result.customFields).toEqual({ company: 'Acme' });
      expect(result.fullName).toBe('John');
    });
  });

  describe('findContactsUUID', () => {
    it('should return contacts with uuid and email', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ id: 1, uuid: 'u1', email: 'a@t.com' }]),
      };
      contactRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findContactsUUID([1], 1);

      expect(result).toEqual([{ id: 1, uuid: 'u1', email: 'a@t.com' }]);
    });
  });

  describe('snakeToCamelCase', () => {
    it('should convert snake_case to camelCase', () => {
      expect(service.snakeToCamelCase('first_name')).toBe('firstName');
      expect(service.snakeToCamelCase('last_click_date')).toBe('lastClickDate');
      expect(service.snakeToCamelCase('id')).toBe('id');
    });
  });

  describe('getAutomationsByTag', () => {
    it('should return cached automations', async () => {
      const automations = [createAutomation()];
      const serialized = JSON.stringify(automations);
      mockRedisClient.get.mockResolvedValue(serialized);

      const result = await service.getAutomationsByTag(100, 1);

      expect(result).toEqual(JSON.parse(serialized));
    });

    it('should query and cache when not in redis', async () => {
      const automations = [createAutomation()];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(null));
      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(automations),
      };
      automationRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getAutomationsByTag(100, 1);

      expect(result).toEqual(automations);
      expect(mockRedisClient.set).toHaveBeenCalled();
    });
  });

  describe('getAutomationsByPush', () => {
    it('should return cached automations', async () => {
      const automations = [createAutomation()];
      const serialized = JSON.stringify(automations);
      mockRedisClient.get.mockResolvedValue(serialized);

      const result = await service.getAutomationsByPush(1, 'web-push');

      expect(result).toEqual(JSON.parse(serialized));
    });

    it('should query and cache when not in redis', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(null));
      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      automationRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getAutomationsByPush(1, 'web-push');

      expect(result).toEqual([]);
      expect(mockRedisClient.set).toHaveBeenCalled();
    });
  });

  describe('getAutomationsByEvent', () => {
    it('should return cached automations', async () => {
      const automations = [createAutomation()];
      const serialized = JSON.stringify(automations);
      mockRedisClient.get.mockResolvedValue(serialized);

      const result = await service.getAutomationsByEvent(1, 'open', 200);

      expect(result).toEqual(JSON.parse(serialized));
    });

    it('should query with custom_events type', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(null));
      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      automationRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.getAutomationsByEvent(1, 'custom_events', 200);

      expect(mockQb.andWhere).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should query with non-custom_events type', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(null));
      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      automationRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.getAutomationsByEvent(1, 'open', 200);

      expect(mockRedisClient.set).toHaveBeenCalled();
    });
  });

  describe('getCampaignsByEvent', () => {
    it('should return cached campaigns', async () => {
      const campaigns = [createAutomation()];
      const serialized = JSON.stringify(campaigns);
      mockRedisClient.get.mockResolvedValue(serialized);

      const result = await service.getCampaignsByEvent(1, 'open', 200);

      expect(result).toEqual(JSON.parse(serialized));
    });

    it('should query and convert campaigns to AutomationEntity format', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(null));
      const mockCampaign = {
        id: 50,
        title: 'Campaign',
        name: 'campaign-1',
        account: createAccount(),
        steps: '[]',
        triggers: {},
        isRateLimit: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockCampaign]),
      };
      campaignRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getCampaignsByEvent(1, 'open', 200);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('campaign');
      expect(result[0].isActive).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should not cache when no campaigns found', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(null));
      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      campaignRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getCampaignsByEvent(1, 'open', 200);

      expect(result).toEqual([]);
      // set is called only for cache
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('should use custom_events filter type correctly', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(null));
      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      campaignRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.getCampaignsByEvent(1, 'custom_events', 200);

      // Should use 'type' filter instead of 'eventType' for custom_events
      expect(mockQb.andWhere).toHaveBeenCalled();
    });
  });

  describe('getTagByName', () => {
    it('should return cached tag', async () => {
      const tag = createTag();
      const serialized = JSON.stringify(tag);
      mockRedisClient.get.mockResolvedValue(serialized);

      const result = await service.getTagByName('test-tag', 1);

      expect(result).toEqual(JSON.parse(serialized));
    });

    it('should query and cache when not in redis', async () => {
      const tag = createTag();
      mockRedisClient.get.mockResolvedValue(JSON.stringify(null));
      tagRepository.findOne.mockResolvedValue(tag);

      const result = await service.getTagByName('Test-TAG', 1);

      expect(result).toEqual(tag);
      expect(tagRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ accountId: 1 }),
        }),
      );
      expect(mockRedisClient.set).toHaveBeenCalled();
    });
  });

  describe('createContactAutomations', () => {
    it('should insert contact automation with orIgnore', async () => {
      const mockQb = {
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ generatedMaps: [{ id: 1 }] }),
      };
      contactAutomationRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.createContactAutomations({ contactId: 1, automationId: 10 });

      expect(mockQb.orIgnore).toHaveBeenCalledWith(true);
      expect(result).toEqual({ generatedMaps: [{ id: 1 }] });
    });
  });

  describe('queryEventsLogs', () => {
    it('should delegate to clickhouseProvider', async () => {
      clickhouseProvider.runQuery.mockResolvedValue([{ id: 1 }]);
      const result = await service.queryEventsLogs('SELECT 1');
      expect(result).toEqual([{ id: 1 }]);
    });
  });

  describe('updateContactAutomations', () => {
    it('should merge and update contact automation', async () => {
      const contactAutomation = createContactAutomation();
      const newData = { status: Status.canceled };
      const leadMessage = { id: 1 };
      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      contactAutomationRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.updateContactAutomations(contactAutomation, newData, leadMessage);

      expect(contactAutomationRepository.merge).toHaveBeenCalledWith(contactAutomation, newData);
      expect(mockQb.execute).toHaveBeenCalled();
    });

    it('should set redis key when status is canceled', async () => {
      const contactAutomation = createContactAutomation({ status: Status.canceled });
      const newData = { status: Status.canceled };
      const leadMessage = { id: 5 };
      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      contactAutomationRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.updateContactAutomations(contactAutomation, newData, leadMessage);

      expect(mockRedisClient.set).toHaveBeenCalledWith('automation_to_stop:5', 'true', 'EX', expect.any(Number));
    });
  });

  describe('completeAutomations', () => {
    it('should update status to completed', async () => {
      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      contactAutomationRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.completeAutomations(1, 10);

      expect(mockQb.set).toHaveBeenCalledWith({ status: Status.completed });
    });
  });

  describe('getContactAutomations', () => {
    it('should find contact automation with status filter', async () => {
      const ca = createContactAutomation();
      contactAutomationRepository.findOne.mockResolvedValue(ca);

      const result = await service.getContactAutomations(100, 10, 1, ['running']);

      expect(result).toEqual(ca);
      expect(contactAutomationRepository.findOne).toHaveBeenCalled();
    });
  });

  describe('getAllContactAutomations', () => {
    it('should find all contact automations', async () => {
      const cas = [createContactAutomation()];
      contactAutomationRepository.find.mockResolvedValue(cas);

      const result = await service.getAllContactAutomations(100, 10, 1, ['running']);

      expect(result).toEqual(cas);
    });
  });

  describe('getFirstContactAutomations', () => {
    it('should find first contact automation without status filter', async () => {
      const ca = createContactAutomation();
      contactAutomationRepository.findOne.mockResolvedValue(ca);

      const result = await service.getFirstContactAutomations(100, 10, 1);

      expect(result).toEqual(ca);
    });
  });

  describe('deleteContactTag', () => {
    it('should delete contact tag', async () => {
      contactTagRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deleteContactTag(100, 50, 1);

      expect(contactTagRepository.delete).toHaveBeenCalledWith({ contactId: 100, tagId: 50, accountId: 1 });
    });
  });

  describe('createContactTag', () => {
    it('should create and save contact tag', async () => {
      const tag = { contactId: 100, tagId: 50, accountId: 1 };
      contactTagRepository.create.mockReturnValue(tag);
      contactTagRepository.save.mockResolvedValue(tag);

      const result = await service.createContactTag(100, 50, 1);

      expect(result).toEqual(tag);
    });
  });

  describe('findContactsByEmail', () => {
    it('should find contacts by emails in lowercase', async () => {
      const contacts = [createContact()];
      contactRepository.find.mockResolvedValue(contacts);

      const result = await service.findContactsByEmail(['TEST@example.com'], 1);

      expect(result).toEqual(contacts);
      expect(contactRepository.find).toHaveBeenCalled();
    });
  });

  describe('deleteContactTagBatch', () => {
    it('should delete tags in batch', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      contactTagRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.deleteContactTagBatch([1, 2], 50, 1);

      expect(mockQb.execute).toHaveBeenCalled();
    });
  });

  describe('createContactTagBatch', () => {
    it('should insert tags in batch', async () => {
      const mockQb = {
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      contactTagRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.createContactTagBatch([{ contactId: 1, tagId: 50, accountId: 1 }]);

      expect(mockQb.execute).toHaveBeenCalled();
    });

    it('should handle error gracefully and return true', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const mockQb = {
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('constraint error')),
      };
      contactTagRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.createContactTagBatch([]);

      expect(result).toBe(true);
    });
  });

  describe('createContactsBatch', () => {
    it('should insert contacts in batch', async () => {
      const mockQb = {
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ identifiers: [{ id: 1 }] }),
      };
      contactRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.createContactsBatch([{ email: 'a@t.com' }]);

      expect(result).toEqual({ identifiers: [{ id: 1 }] });
    });

    it('should handle error and return true', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const mockQb = {
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('db error')),
      };
      contactRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.createContactsBatch([]);

      expect(result).toBe(true);
    });
  });

  describe('getTagById', () => {
    it('should find tag by id', async () => {
      const tag = createTag();
      tagRepository.findOne.mockResolvedValue(tag);

      const result = await service.getTagById(100);

      expect(result).toEqual(tag);
    });
  });

  describe('queryRunner', () => {
    it('should execute raw query', async () => {
      entityManager.query.mockResolvedValue([{ count: 5 }]);

      const result = await service.queryRunner('SELECT COUNT(*) count FROM contacts');

      expect(result).toEqual([{ count: 5 }]);
    });
  });

  describe('processSegment', () => {
    let mockQueryRunner: any;

    beforeEach(() => {
      mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          query: jest.fn().mockResolvedValue([]),
          delete: jest.fn().mockResolvedValue(undefined),
        },
      };
      contactTagRepository.manager.connection.createQueryRunner.mockReturnValue(mockQueryRunner);
    });

    it('should delete all contacts for tag when query is null', async () => {
      await service.processSegment(100, 1, null, null);

      expect(mockQueryRunner.manager.delete).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should execute insert and delete queries when query is provided', async () => {
      mockQueryRunner.manager.query
        .mockResolvedValueOnce(undefined) // main query
        .mockResolvedValueOnce([[{ contact_id: 1 }]]) // delete
        .mockResolvedValueOnce([{ contact_id: 2 }]) // insert
        .mockResolvedValueOnce(undefined); // cleanup

      await service.processSegment(100, 1, 'SELECT 1', null);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should handle externalQueries with clickhouse', async () => {
      clickhouseProvider.runQuery.mockResolvedValue([{ contact_id: 1 }, { contact_id: 2 }]);

      await service.processSegment(100, 1, 'SELECT 1', [
        { tableName: 'temp_events', query: 'SELECT contact_id FROM events', filterType: 'contact_id' },
      ]);

      expect(clickhouseProvider.runQuery).toHaveBeenCalled();
    });

    it('should handle externalQueries with email filter', async () => {
      clickhouseProvider.runQuery.mockResolvedValue([{ email: 'a@t.com' }]);

      await service.processSegment(100, 1, 'SELECT 1', [
        { tableName: 'temp_emails', query: 'SELECT email FROM events', filterType: 'email' },
      ]);

      expect(clickhouseProvider.runQuery).toHaveBeenCalled();
    });

    it('should rollback on error and return null ids', async () => {
      mockQueryRunner.manager.query.mockRejectedValue(new Error('db error'));

      // The finally block always returns { deleteIds, insertIds } even after error
      const result = await service.processSegment(100, 1, 'BAD QUERY', null);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(result).toEqual({ deleteIds: null, insertIds: null });
    });
  });

  describe('updateTag', () => {
    it('should update tag with changes', async () => {
      tagRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateTag(100, { lastCount: 50 });

      expect(tagRepository.update).toHaveBeenCalledWith(100, { lastCount: 50 });
    });
  });

  describe('updateContact', () => {
    it('should update contact with changes', async () => {
      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      contactRepository.createQueryBuilder.mockReturnValue(mockQb);

      const contact = createContact();
      await service.updateContact(contact, { lastAutomation: new Date() });

      expect(mockQb.execute).toHaveBeenCalled();
    });

    it('should handle error gracefully', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('update error')),
      };
      contactRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.updateContact(createContact(), {});

      expect(result).toBeUndefined();
    });
  });

  describe('getNumberContactsByTag', () => {
    it('should return counts from query', async () => {
      const counts = { total: 10, email: 5, mobile_push: 1, web_push: 2, phone: 1, whatsapp: 1 };
      const mockQb = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(counts),
      };
      contactTagRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getNumberContactsByTag(1, 100);

      expect(result).toEqual(counts);
    });

    it('should return zero counts when no result', async () => {
      const mockQb = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };
      contactTagRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getNumberContactsByTag(1, 100);

      expect(result).toEqual({ total: 0, email: 0, mobile_push: 0, web_push: 0, phone: 0, whatsapp: 0 });
    });
  });

  describe('updateLead', () => {
    it('should update lead with changes', async () => {
      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      leadRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.updateLead(1, { automationId: 10, automationTitle: 'Test', automationStatus: 'running' });

      expect(mockQb.execute).toHaveBeenCalled();
    });

    it('should return early when leadId is falsy', async () => {
      const result = await service.updateLead(0, {
        automationId: 10,
        automationTitle: 'Test',
        automationStatus: 'running',
      });

      expect(result).toBeUndefined();
    });
  });

  describe('findContactByIdConditional', () => {
    it('should load contact with specified joins and parse custom fields', async () => {
      const mockContact = {
        id: 1,
        accountId: 1,
        parseCustomFields: jest.fn(),
        customFields: [],
        tags: [],
      };
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockContact),
      };
      contactConditionalRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findContactByIdConditional(1, 1, ['tags', 'customFields']);

      expect(mockContact.parseCustomFields).toHaveBeenCalledWith(CustomFieldKeyType.ID);
      expect(mockQb.leftJoinAndSelect).toHaveBeenCalledTimes(3); // tags, customFields, customFieldType
    });

    it('should use provided keyType', async () => {
      const mockContact = {
        id: 1,
        parseCustomFields: jest.fn(),
      };
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockContact),
      };
      contactConditionalRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findContactByIdConditional(1, 1, [], CustomFieldKeyType.NAME);

      expect(mockContact.parseCustomFields).toHaveBeenCalledWith(CustomFieldKeyType.NAME);
    });
  });

  describe('findLeadById', () => {
    it('should find lead by id', async () => {
      leadRepository.findOne.mockResolvedValue({ id: 1 });
      const result = await service.findLeadById(1);
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('completeTargetedAutomations', () => {
    it('should complete running automations and delete tag', async () => {
      const automations = [createContactAutomation()];
      contactAutomationRepository.find.mockResolvedValue(automations);
      entityManager.query.mockResolvedValue(undefined);

      const tag = createTag({ id: 50 });
      mockRedisClient.get.mockResolvedValue(JSON.stringify(null));
      tagRepository.findOne.mockResolvedValue(tag);
      contactTagRepository.delete.mockResolvedValue({ affected: 1 });

      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      contactAutomationRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.completeTargetedAutomations('2024-01-01', {
        accountId: 1,
        automationId: 10,
        contactId: 100,
      });

      expect(result).toEqual(automations);
    });

    it('should return empty array when no running automations', async () => {
      contactAutomationRepository.find.mockResolvedValue([]);

      const result = await service.completeTargetedAutomations('2024-01-01', {
        accountId: 1,
        automationId: 10,
        contactId: 100,
      });

      expect(result).toEqual([]);
    });

    it('should skip tag deletion when tag not found', async () => {
      const automations = [createContactAutomation()];
      contactAutomationRepository.find.mockResolvedValue(automations);
      entityManager.query.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue(JSON.stringify(null));
      tagRepository.findOne.mockResolvedValue(null);

      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      contactAutomationRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.completeTargetedAutomations('2024-01-01', {
        accountId: 1,
        automationId: 10,
        contactId: 100,
      });

      expect(contactTagRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('createSegmentTable', () => {
    let mockQueryRunner: any;

    beforeEach(() => {
      mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          query: jest.fn().mockResolvedValue(undefined),
        },
      };
      contactTagRepository.manager.connection.createQueryRunner.mockReturnValue(mockQueryRunner);
    });

    it('should create temp table and insert contacts', async () => {
      const result = await service.createSegmentTable(100, [[1, 2, 3]], 'in');

      expect(result).toContain('segment_100_in_');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      mockQueryRunner.manager.query.mockRejectedValue(new Error('db error'));

      await expect(service.createSegmentTable(100, [[1]], 'out')).rejects.toThrow('Error executing segment');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('processSegmentOutLogic', () => {
    let mockQueryRunner: any;

    beforeEach(() => {
      mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          query: jest.fn(),
        },
      };
      contactTagRepository.manager.connection.createQueryRunner.mockReturnValue(mockQueryRunner);
    });

    it('should return data and drop temp table', async () => {
      const data = [{ id: 1, uuid: 'u1', unsub: false, bounced: true }];
      mockQueryRunner.manager.query.mockResolvedValueOnce(data).mockResolvedValueOnce(undefined);

      const result = await service.processSegmentOutLogic(30, 30, 1, 100, 'temp_table', 1, 'America/Sao_Paulo');

      expect(result).toEqual(data);
      expect(mockQueryRunner.manager.query).toHaveBeenCalledWith('DROP TABLE temp_table');
    });

    it('should drop table and throw on error', async () => {
      mockQueryRunner.manager.query.mockRejectedValueOnce(new Error('query error')).mockResolvedValueOnce(undefined);

      await expect(
        service.processSegmentOutLogic(30, 30, 1, 100, 'temp_table', 1, 'America/Sao_Paulo'),
      ).rejects.toThrow('Error executing segment');
    });
  });

  describe('processSegmentInLogic', () => {
    let mockQueryRunner: any;

    beforeEach(() => {
      mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          query: jest.fn(),
        },
      };
      contactTagRepository.manager.connection.createQueryRunner.mockReturnValue(mockQueryRunner);
    });

    it('should return data and drop temp table', async () => {
      const data = [{ id: 1, uuid: 'u1', bought: true, reengaged: false }];
      mockQueryRunner.manager.query.mockResolvedValueOnce(data).mockResolvedValueOnce(undefined);

      const result = await service.processSegmentInLogic(1, 'temp_table', '2024-01-01');

      expect(result).toEqual(data);
    });

    it('should drop table and throw on error', async () => {
      mockQueryRunner.manager.query.mockRejectedValueOnce(new Error('query error')).mockResolvedValueOnce(undefined);

      await expect(service.processSegmentInLogic(1, 'temp_table', '2024-01-01')).rejects.toThrow(
        'Error executing segment',
      );
    });
  });
});
