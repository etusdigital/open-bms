import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MsgopsService } from '../../src/msgops/msgops.service';
import { MessageEntity } from '../../src/msgops/entities/message.entity';
import { ContactEntity } from '../../src/msgops/entities/contact.entity';
import { ContactCustomFieldEntity } from '../../src/msgops/entities/contact-custom-field.entity';
import { LeadsEntity } from '../../src/msgops/entities/leads.entity';
import { RedisService } from '../../src/providers/redis/redis.service';
import { EntityManager } from 'typeorm';
import { ClickhouseProvider } from '../../src/providers/clickhouse.provider';
import { CustomFieldKeyType } from '../../src/interfaces';

describe('Database Integration Tests', () => {
  let service: MsgopsService;
  let messageRepository: any;
  let contactRepository: any;
  let contactCustomFieldsRepository: any;
  let leadRepository: any;
  let redisClient: any;
  let entityManager: any;
  let clickhouseProvider: any;

  beforeEach(async () => {
    // Create Redis client mock
    redisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    // Create QueryBuilder mock factory
    const createQueryBuilder = () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn(),
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orUpdate: jest.fn().mockReturnThis(),
      };
      // Store reference to return it
      Object.assign(mockQueryBuilder, { _self: mockQueryBuilder });
      return mockQueryBuilder;
    };

    // Create repository mocks
    messageRepository = {
      findOne: jest.fn(),
      createQueryBuilder: createQueryBuilder,
    };

    contactRepository = {
      findOne: jest.fn(),
      createQueryBuilder: createQueryBuilder,
    };

    contactCustomFieldsRepository = {
      findOne: jest.fn(),
      createQueryBuilder: createQueryBuilder,
    };

    leadRepository = {
      findOne: jest.fn(),
      createQueryBuilder: createQueryBuilder,
    };

    entityManager = {
      query: jest.fn(),
    };

    clickhouseProvider = {
      runQuery: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MsgopsService,
        {
          provide: getRepositoryToken(MessageEntity),
          useValue: messageRepository,
        },
        {
          provide: getRepositoryToken(ContactEntity),
          useValue: contactRepository,
        },
        {
          provide: getRepositoryToken(ContactCustomFieldEntity),
          useValue: contactCustomFieldsRepository,
        },
        {
          provide: getRepositoryToken(LeadsEntity),
          useValue: leadRepository,
        },
        {
          provide: RedisService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(redisClient),
          },
        },
        {
          provide: EntityManager,
          useValue: entityManager,
        },
        {
          provide: ClickhouseProvider,
          useValue: clickhouseProvider,
        },
      ],
    }).compile();

    service = module.get<MsgopsService>(MsgopsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMessageById', () => {
    it('should return cached message from Redis when available', async () => {
      // Arrange
      const messageId = 100;
      const cachedMessage = {
        id: messageId,
        title: 'Cached Email',
        subject: 'Test Subject',
        previewText: 'Preview',
      };
      redisClient.get.mockResolvedValue(JSON.stringify(cachedMessage));

      // Act
      const result = await service.getMessageById(messageId);

      // Assert
      expect(redisClient.get).toHaveBeenCalledWith(`step_message:${messageId}`);
      expect(result).toEqual(cachedMessage);
      expect(messageRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from database when not in cache', async () => {
      // Arrange
      const messageId = 200;
      const dbMessage = {
        id: messageId,
        title: 'DB Email',
        subject: 'Subject',
        previewText: 'Preview',
        type: 'email',
        bucketName: 'test-bucket',
        fileName: 'test-file.html',
        fromName: 'John Doe',
        fromMail: 'john@example.com',
        replyTo: 'reply@example.com',
        ippool: 'default',
      };

      redisClient.get.mockResolvedValue(null);
      messageRepository.findOne.mockResolvedValue(dbMessage);

      // Act
      const result = await service.getMessageById(messageId);

      // Assert
      expect(redisClient.get).toHaveBeenCalledWith(`step_message:${messageId}`);
      expect(messageRepository.findOne).toHaveBeenCalledWith({
        where: { id: messageId },
      });
      expect(redisClient.set).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should parse and format message before caching', async () => {
      // Arrange
      const messageId = 300;
      const dbMessage = {
        id: messageId,
        title: 'Parse Test',
        subject: 'Subject',
        type: 'email',
        bucketName: 'test-bucket',
        fileName: 'test.html',
        fromName: 'Jane Doe',
        fromMail: 'jane@example.com',
        replyTo: 'reply@test.com',
        ippool: 'pool1',
      };

      redisClient.get.mockResolvedValue(null);
      messageRepository.findOne.mockResolvedValue(dbMessage);

      // Act
      const result = await service.getMessageById(messageId);

      // Assert
      expect(result).toHaveProperty('location');
      expect(result.location).toEqual({
        bucketName: 'test-bucket',
        fileName: 'test.html',
      });
      expect(result).toHaveProperty('from');
      expect(result.from).toEqual({
        firstName: 'Jane Doe',
        email: 'jane@example.com',
      });
      expect(result).not.toHaveProperty('bucketName');
      expect(result).not.toHaveProperty('fileName');
      expect(result).not.toHaveProperty('fromName');
      expect(result).not.toHaveProperty('fromMail');
    });

    it('should cache formatted message in Redis', async () => {
      // Arrange
      const messageId = 400;
      const dbMessage = {
        id: messageId,
        title: 'Cache Test',
        type: 'email',
        bucketName: 'bucket',
        fileName: 'file.html',
        fromName: 'Test User',
        fromMail: 'test@example.com',
      };

      redisClient.get.mockResolvedValue(null);
      messageRepository.findOne.mockResolvedValue(dbMessage);

      // Act
      await service.getMessageById(messageId);

      // Assert
      expect(redisClient.set).toHaveBeenCalledWith(`step_message:${messageId}`, expect.any(String));

      const cachedValue = JSON.parse(redisClient.set.mock.calls[0][1]);
      expect(cachedValue).toHaveProperty('location');
      expect(cachedValue).toHaveProperty('from');
    });

    it('should handle web-push message type without parsing', async () => {
      // Arrange
      const messageId = 500;
      const webPushMessage = {
        id: messageId,
        title: 'Push Notification',
        type: 'web-push',
        body: 'Push body',
        icon: 'icon.png',
      };

      redisClient.get.mockResolvedValue(null);
      messageRepository.findOne.mockResolvedValue(webPushMessage);

      // Act
      const result = await service.getMessageById(messageId);

      // Assert
      expect(result).toEqual(webPushMessage);
      expect(result).not.toHaveProperty('location');
      expect(result).not.toHaveProperty('from');
    });

    it('should handle null message from database', async () => {
      // Arrange
      const messageId = 600;
      redisClient.get.mockResolvedValue(null);
      messageRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getMessageById(messageId)).rejects.toThrow();
    });
  });

  describe('findContactById', () => {
    it('should find contact with basic query', async () => {
      // Arrange
      const contactId = 100;
      const accountId = 1;
      const loadContacts = new Set<string>();
      const mockContact = {
        id: contactId,
        accountId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        parseCustomFields: jest.fn(),
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockContact),
      };
      contactRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.findContactById(contactId, accountId, loadContacts);

      // Assert
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('contact.id = :id AND contact.account_id = :accountId', { id: contactId, accountId });
      expect(result).toEqual(mockContact);
      expect(mockContact.parseCustomFields).toHaveBeenCalledWith(CustomFieldKeyType.ID);
    });

    it('should load customFields relation when requested', async () => {
      // Arrange
      const contactId = 200;
      const accountId = 1;
      const loadContacts = new Set(['customFields']);
      const mockContact = {
        id: contactId,
        email: 'custom@test.com',
        customFields: [
          { id: 1, key: 'field1', value: 'value1' },
          { id: 2, key: 'field2', value: 'value2' },
        ],
        parseCustomFields: jest.fn(),
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockContact),
      };
      contactRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await service.findContactById(contactId, accountId, loadContacts);

      // Assert
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('contact.customFields', 'customFields');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('customFields.customFieldType', 'customFieldType');
    });

    it('should load tags relation when requested', async () => {
      // Arrange
      const contactId = 300;
      const accountId = 1;
      const loadContacts = new Set(['tags']);
      const mockContact = {
        id: contactId,
        email: 'tags@test.com',
        tags: [
          { id: 1, name: 'VIP' },
          { id: 2, name: 'Active' },
        ],
        parseCustomFields: jest.fn(),
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockContact),
      };
      contactRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await service.findContactById(contactId, accountId, loadContacts);

      // Assert
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('contact.tags', 'tags');
    });

    it('should load contactAutomations relation when requested', async () => {
      // Arrange
      const contactId = 400;
      const accountId = 1;
      const loadContacts = new Set(['contactAutomations']);
      const mockContact = {
        id: contactId,
        email: 'automation@test.com',
        contactAutomations: [
          { automationId: 10, status: 'active' },
          { automationId: 20, status: 'completed' },
        ],
        parseCustomFields: jest.fn(),
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockContact),
      };
      contactRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await service.findContactById(contactId, accountId, loadContacts);

      // Assert
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('contact.contactAutomations', 'contactAutomations');
    });

    it('should load multiple relations when requested', async () => {
      // Arrange
      const contactId = 500;
      const accountId = 1;
      const loadContacts = new Set(['customFields', 'tags', 'contactAutomations']);
      const mockContact = {
        id: contactId,
        email: 'multi@test.com',
        customFields: [],
        tags: [],
        contactAutomations: [],
        parseCustomFields: jest.fn(),
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockContact),
      };
      contactRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await service.findContactById(contactId, accountId, loadContacts);

      // Assert
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledTimes(4); // customFields (2x), tags, contactAutomations
    });

    it('should use specified keyType for parseCustomFields', async () => {
      // Arrange
      const contactId = 600;
      const accountId = 1;
      const loadContacts = new Set<string>();
      const keyType = CustomFieldKeyType.NAME;
      const mockContact = {
        id: contactId,
        email: 'keytype@test.com',
        parseCustomFields: jest.fn(),
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockContact),
      };
      contactRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await service.findContactById(contactId, accountId, loadContacts, keyType);

      // Assert
      expect(mockContact.parseCustomFields).toHaveBeenCalledWith(CustomFieldKeyType.NAME);
    });

    it('should handle contact not found', async () => {
      // Arrange
      const contactId = 700;
      const accountId = 1;
      const loadContacts = new Set<string>();

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      contactRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act & Assert
      await expect(service.findContactById(contactId, accountId, loadContacts)).rejects.toThrow();
    });
  });

  describe('findLeadById', () => {
    it('should find lead by id', async () => {
      // Arrange
      const leadId = 100;
      const mockLead = {
        id: leadId,
        email: 'lead@example.com',
        firstName: 'Lead',
        lastName: 'User',
        createdAt: new Date(),
      };

      leadRepository.findOne.mockResolvedValue(mockLead);

      // Act
      const result = await service.findLeadById(leadId);

      // Assert
      expect(leadRepository.findOne).toHaveBeenCalledWith({ where: { id: leadId } });
      expect(result).toEqual(mockLead);
    });

    it('should return null when lead not found', async () => {
      // Arrange
      const leadId = 200;
      leadRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findLeadById(leadId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle different lead IDs', async () => {
      // Arrange
      const leadIds = [300, 400, 500];
      const mockLeads = leadIds.map((id) => ({
        id,
        email: `lead${id}@test.com`,
      }));

      // Act & Assert
      for (let i = 0; i < leadIds.length; i++) {
        leadRepository.findOne.mockResolvedValue(mockLeads[i]);
        const result = await service.findLeadById(leadIds[i]);
        expect(result).toEqual(mockLeads[i]);
      }
    });
  });

  describe('updateContact', () => {
    it('should update contact with given parameters', async () => {
      // Arrange
      const params = { hasEmail: true, hasBounced: false };
      const contactId = 100;
      const accountId = 1;

      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      contactRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await service.updateContact(params, contactId, accountId);

      // Assert
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith(params);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id = :contactId AND account_id = :accountId', { contactId, accountId });
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });

    it('should update multiple fields at once', async () => {
      // Arrange
      const params = {
        firstName: 'Updated',
        lastName: 'Name',
        hasEmail: true,
      };
      const contactId = 200;
      const accountId = 1;

      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      contactRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await service.updateContact(params, contactId, accountId);

      // Assert
      expect(mockQueryBuilder.set).toHaveBeenCalledWith(params);
    });

    it('should handle empty params object', async () => {
      // Arrange
      const params = {};
      const contactId = 300;
      const accountId = 1;

      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      contactRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await service.updateContact(params, contactId, accountId);

      // Assert
      expect(mockQueryBuilder.set).toHaveBeenCalledWith(params);
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });
  });

  describe('createOrUpdateCustomFields', () => {
    it('should insert custom fields with upsert behavior', async () => {
      // Arrange
      const customFields = [
        {
          accountId: 1,
          contactId: 100,
          customFieldId: 10,
          value: 'value1',
        } as ContactCustomFieldEntity,
        {
          accountId: 1,
          contactId: 100,
          customFieldId: 20,
          value: 'value2',
        } as ContactCustomFieldEntity,
      ];

      const mockQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orUpdate: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      contactCustomFieldsRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await service.createOrUpdateCustomFields(customFields);

      // Assert
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(mockQueryBuilder.values).toHaveBeenCalledWith(customFields);
      expect(mockQueryBuilder.orUpdate).toHaveBeenCalledWith(['value'], ['account_id', 'contact_id', 'custom_field_id']);
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });

    it('should handle single custom field', async () => {
      // Arrange
      const customFields = [
        {
          accountId: 1,
          contactId: 200,
          customFieldId: 30,
          value: 'single value',
        } as ContactCustomFieldEntity,
      ];

      const mockQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orUpdate: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      contactCustomFieldsRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await service.createOrUpdateCustomFields(customFields);

      // Assert
      expect(mockQueryBuilder.values).toHaveBeenCalledWith(customFields);
    });

    it('should handle empty array', async () => {
      // Arrange
      const customFields: ContactCustomFieldEntity[] = [];

      const mockQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orUpdate: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      contactCustomFieldsRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await service.createOrUpdateCustomFields(customFields);

      // Assert
      expect(mockQueryBuilder.values).toHaveBeenCalledWith(customFields);
    });
  });

  describe('queryRunner', () => {
    it('should execute raw SQL query', async () => {
      // Arrange
      const query = 'SELECT * FROM contacts WHERE email = $1';
      const mockResult = [
        { id: 100, email: 'query@test.com' },
        { id: 200, email: 'query2@test.com' },
      ];

      entityManager.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.queryRunner(query);

      // Assert
      expect(entityManager.query).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });

    it('should handle complex queries', async () => {
      // Arrange
      const query = `
        SELECT c.*, ca.automation_id
        FROM contacts c
        LEFT JOIN contact_automations ca ON c.id = ca.contact_id
        WHERE c.account_id = 1
      `;
      const mockResult = [{ id: 300, email: 'complex@test.com', automation_id: 10 }];

      entityManager.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.queryRunner(query);

      // Assert
      expect(entityManager.query).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });

    it('should handle queries that return no results', async () => {
      // Arrange
      const query = 'SELECT * FROM contacts WHERE id = 999999';
      entityManager.query.mockResolvedValue([]);

      // Act
      const result = await service.queryRunner(query);

      // Assert
      expect(result).toEqual([]);
    });

    it('should propagate query errors', async () => {
      // Arrange
      const query = 'INVALID SQL SYNTAX';
      const error = new Error('Syntax error');
      entityManager.query.mockRejectedValue(error);

      // Act & Assert
      await expect(service.queryRunner(query)).rejects.toThrow('Syntax error');
    });
  });

  describe('queryEventsLogs', () => {
    it('should execute ClickHouse query', async () => {
      // Arrange
      const query = 'SELECT * FROM events WHERE account_id = 1';
      const mockResult = [
        { event: 'email_sent', timestamp: 1234567890 },
        { event: 'email_opened', timestamp: 1234567900 },
      ];

      clickhouseProvider.runQuery.mockResolvedValue(mockResult);

      // Act
      const result = await service.queryEventsLogs(query);

      // Assert
      expect(clickhouseProvider.runQuery).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });

    it('should handle empty results from ClickHouse', async () => {
      // Arrange
      const query = 'SELECT * FROM events WHERE event = "nonexistent"';
      clickhouseProvider.runQuery.mockResolvedValue([]);

      // Act
      const result = await service.queryEventsLogs(query);

      // Assert
      expect(result).toEqual([]);
    });

    it('should propagate ClickHouse errors', async () => {
      // Arrange
      const query = 'INVALID CLICKHOUSE QUERY';
      const error = new Error('ClickHouse error');
      clickhouseProvider.runQuery.mockRejectedValue(error);

      // Act & Assert
      await expect(service.queryEventsLogs(query)).rejects.toThrow('ClickHouse error');
    });
  });
});
