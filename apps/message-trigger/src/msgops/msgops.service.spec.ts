import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MsgopsService } from './msgops.service';
import { MessageEntity } from './entities/message.entity';
import { ContactEntity } from './entities/contact.entity';
import { ContactCustomFieldEntity } from './entities/contact-custom-field.entity';
import { LeadsEntity } from './entities/leads.entity';
import { ClickhouseProvider } from '../providers/clickhouse.provider';
import { RedisService } from '../providers/redis/redis.service';
import { EntityManager } from 'typeorm';
import { CustomFieldKeyType } from '../interfaces';

describe('MsgopsService', () => {
  let service: MsgopsService;
  let messageRepository: any;
  let contactRepository: any;
  let contactCustomFieldsRepository: any;
  let leadRepository: any;
  let redisClient: any;
  let entityManager: any;

  const mockClickhouseProvider = {
    runQuery: jest.fn(),
  };

  const createMockQueryBuilder = () => ({
    where: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orUpdate: jest.fn().mockReturnThis(),
  });

  const mockMessageRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };

  const mockContactRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };

  const mockContactCustomFieldsRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };

  const mockLeadRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };

  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockRedisService = {
    getOrThrow: jest.fn(() => mockRedisClient),
  };

  const mockEntityManager = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MsgopsService,
        { provide: ClickhouseProvider, useValue: mockClickhouseProvider },
        { provide: getRepositoryToken(MessageEntity), useValue: mockMessageRepository },
        { provide: getRepositoryToken(ContactEntity), useValue: mockContactRepository },
        { provide: getRepositoryToken(ContactCustomFieldEntity), useValue: mockContactCustomFieldsRepository },
        { provide: getRepositoryToken(LeadsEntity), useValue: mockLeadRepository },
        { provide: RedisService, useValue: mockRedisService },
        { provide: EntityManager, useValue: mockEntityManager },
      ],
    }).compile();

    service = module.get<MsgopsService>(MsgopsService);
    messageRepository = mockMessageRepository;
    contactRepository = mockContactRepository;
    contactCustomFieldsRepository = mockContactCustomFieldsRepository;
    leadRepository = mockLeadRepository;
    redisClient = mockRedisClient;
    entityManager = mockEntityManager;

    jest.clearAllMocks();
  });

  describe('queryEventsLogs', () => {
    it('should call clickhouseProvider.runQuery with the provided SQL', async () => {
      const mockResult = [{ contact_id: 123, event: 'resubscribed' }];
      mockClickhouseProvider.runQuery.mockResolvedValue(mockResult);

      const query = 'SELECT * FROM events_logs_v2 WHERE account_id = 1';
      const result = await service.queryEventsLogs(query);

      expect(mockClickhouseProvider.runQuery).toHaveBeenCalledWith(query, undefined);
      expect(result).toEqual(mockResult);
    });

    it('should return empty array when no events found', async () => {
      mockClickhouseProvider.runQuery.mockResolvedValue([]);

      const query = 'SELECT * FROM events_logs_v2 WHERE contact_id = 999';
      const result = await service.queryEventsLogs(query);

      expect(mockClickhouseProvider.runQuery).toHaveBeenCalledWith(query, undefined);
      expect(result).toEqual([]);
    });

    it('should pass complex query unchanged to provider', async () => {
      const complexQuery = `SELECT *
        FROM events_logs_v2
        WHERE account_id = 1
        AND time_date >= '2024-01-01'
        AND event = 'resubscribed'
        AND contact_id = 123
        LIMIT 1`;

      mockClickhouseProvider.runQuery.mockResolvedValue([{ contact_id: 123 }]);

      await service.queryEventsLogs(complexQuery);

      expect(mockClickhouseProvider.runQuery).toHaveBeenCalledWith(complexQuery, undefined);
    });

    it('should forward query params to clickhouseProvider when provided', async () => {
      mockClickhouseProvider.runQuery.mockResolvedValue([]);
      const params = { accountId: 1, contactId: 99 };
      await service.queryEventsLogs('SELECT * FROM events_logs_v2 WHERE account_id = {accountId:UInt64}', params);
      expect(mockClickhouseProvider.runQuery).toHaveBeenCalledWith('SELECT * FROM events_logs_v2 WHERE account_id = {accountId:UInt64}', params);
    });
  });

  describe('getMessageById', () => {
    const mockMessageId = 200;
    const mockRedisKey = `step_message:${mockMessageId}`;

    it('should return cached message from Redis if available', async () => {
      // Arrange
      const cachedMessage = {
        id: mockMessageId,
        title: 'Cached Email',
        subject: 'Cached Subject',
        location: { bucketName: 'bucket', fileName: 'file.html' },
        from: { firstName: 'John', email: 'john@example.com' },
      };
      redisClient.get.mockResolvedValue(JSON.stringify(cachedMessage));

      // Act
      const result = await service.getMessageById(mockMessageId);

      // Assert
      expect(redisClient.get).toHaveBeenCalledWith(mockRedisKey);
      expect(result).toEqual(cachedMessage);
      expect(messageRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in Redis', async () => {
      // Arrange
      const dbMessage = {
        id: mockMessageId,
        type: 'email',
        title: 'DB Email',
        subject: 'DB Subject',
        bucketName: 'test-bucket',
        fileName: 'test-file.html',
        fromName: 'Jane',
        fromMail: 'jane@example.com',
      };
      redisClient.get.mockResolvedValue(null);
      messageRepository.findOne.mockResolvedValue(dbMessage);

      // Act
      const result = await service.getMessageById(mockMessageId);

      // Assert
      expect(redisClient.get).toHaveBeenCalledWith(mockRedisKey);
      expect(messageRepository.findOne).toHaveBeenCalledWith({ where: { id: mockMessageId } });
      expect(redisClient.set).toHaveBeenCalled();
      expect(result).toHaveProperty('location');
      expect(result.location).toEqual({ bucketName: 'test-bucket', fileName: 'test-file.html' });
      expect(result).toHaveProperty('from');
      expect(result.from).toEqual({ firstName: 'Jane', email: 'jane@example.com' });
    });

    it('should return web-push message without parsing', async () => {
      // Arrange
      const webPushMessage = {
        id: mockMessageId,
        type: 'web-push',
        title: 'Push Notification',
        body: 'Test notification',
      };
      redisClient.get.mockResolvedValue(null);
      messageRepository.findOne.mockResolvedValue(webPushMessage);

      // Act
      const result = await service.getMessageById(mockMessageId);

      // Assert
      expect(result).toEqual(webPushMessage);
      expect(redisClient.set).toHaveBeenCalledWith(mockRedisKey, JSON.stringify(webPushMessage));
    });

    it('should parse regular email message', async () => {
      // Arrange
      const emailMessage = {
        id: mockMessageId,
        type: 'email',
        title: 'Email Title',
        subject: 'Email Subject',
        bucketName: 'my-bucket',
        fileName: 'my-file.html',
        fromName: 'Sender Name',
        fromMail: 'sender@example.com',
        previewText: 'Preview',
      };
      redisClient.get.mockResolvedValue(null);
      messageRepository.findOne.mockResolvedValue(emailMessage);

      // Act
      const result = await service.getMessageById(mockMessageId);

      // Assert
      expect(result).not.toHaveProperty('bucketName');
      expect(result).not.toHaveProperty('fileName');
      expect(result).not.toHaveProperty('fromName');
      expect(result).not.toHaveProperty('fromMail');
      expect(result.location).toEqual({ bucketName: 'my-bucket', fileName: 'my-file.html' });
      expect(result.from).toEqual({ firstName: 'Sender Name', email: 'sender@example.com' });
    });
  });

  describe('findContactById', () => {
    const mockContactId = 123;
    const mockAccountId = 1;

    it('should find contact with basic query', async () => {
      // Arrange
      const mockContact = {
        id: mockContactId,
        email: 'test@example.com',
        parseCustomFields: jest.fn(),
      };
      const queryBuilder = createMockQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(mockContact);
      contactRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      // Act
      const result = await service.findContactById(mockContactId, mockAccountId, []);

      // Assert
      expect(contactRepository.createQueryBuilder).toHaveBeenCalledWith('contact');
      expect(queryBuilder.where).toHaveBeenCalledWith('contact.id = :id AND contact.account_id = :accountId', { id: mockContactId, accountId: mockAccountId });
      expect(mockContact.parseCustomFields).toHaveBeenCalledWith(CustomFieldKeyType.ID);
      expect(result).toEqual(mockContact);
    });

    it('should load customFields with join', async () => {
      // Arrange
      const mockContact = {
        id: mockContactId,
        email: 'test@example.com',
        customFields: [],
        parseCustomFields: jest.fn(),
      };
      const queryBuilder = createMockQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(mockContact);
      contactRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      // Act
      await service.findContactById(mockContactId, mockAccountId, ['customFields']);

      // Assert
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('contact.customFields', 'customFields');
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('customFields.customFieldType', 'customFieldType');
    });

    it('should load multiple relations', async () => {
      // Arrange
      const mockContact = {
        id: mockContactId,
        parseCustomFields: jest.fn(),
      };
      const queryBuilder = createMockQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(mockContact);
      contactRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      // Act
      await service.findContactById(mockContactId, mockAccountId, ['tags', 'automations']);

      // Assert
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('contact.tags', 'tags');
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('contact.automations', 'automations');
    });

    it('should use custom keyType for parseCustomFields', async () => {
      // Arrange
      const mockContact = {
        id: mockContactId,
        parseCustomFields: jest.fn(),
      };
      const queryBuilder = createMockQueryBuilder();
      queryBuilder.getOne.mockResolvedValue(mockContact);
      contactRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      // Act
      await service.findContactById(mockContactId, mockAccountId, [], CustomFieldKeyType.NAME);

      // Assert
      expect(mockContact.parseCustomFields).toHaveBeenCalledWith(CustomFieldKeyType.NAME);
    });
  });

  describe('findLeadById', () => {
    it('should find lead by id', async () => {
      // Arrange
      const mockLeadId = 456;
      const mockLead = { id: mockLeadId, data: { test: 'value' } };
      leadRepository.findOne.mockResolvedValue(mockLead);

      // Act
      const result = await service.findLeadById(mockLeadId);

      // Assert
      expect(leadRepository.findOne).toHaveBeenCalledWith({ where: { id: mockLeadId } });
      expect(result).toEqual(mockLead);
    });

    it('should return null if lead not found', async () => {
      // Arrange
      leadRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findLeadById(999);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('parseMessage', () => {
    it('should parse message entity to Email format', async () => {
      // Arrange
      const messageEntity = {
        id: 100,
        title: 'Test Email',
        subject: 'Test Subject',
        bucketName: 'test-bucket',
        fileName: 'test-file.html',
        fromName: 'John Doe',
        fromMail: 'john@example.com',
        previewText: 'Preview',
        type: 'email',
      } as MessageEntity;

      // Act
      const result = await service.parseMessage(messageEntity);

      // Assert
      expect(result).toHaveProperty('location');
      expect(result.location).toEqual({ bucketName: 'test-bucket', fileName: 'test-file.html' });
      expect(result).toHaveProperty('from');
      expect(result.from).toEqual({ firstName: 'John Doe', email: 'john@example.com' });
      expect(result).not.toHaveProperty('bucketName');
      expect(result).not.toHaveProperty('fileName');
      expect(result).not.toHaveProperty('fromName');
      expect(result).not.toHaveProperty('fromMail');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('subject');
    });

    it('should preserve other message properties', async () => {
      // Arrange
      const messageEntity = {
        id: 200,
        title: 'Complex Email',
        subject: 'Complex Subject',
        bucketName: 'bucket',
        fileName: 'file.html',
        fromName: 'Jane',
        fromMail: 'jane@example.com',
        previewText: 'Preview text',
        replyTo: 'reply@example.com',
        priority: 'high',
        ippool: 'pool-1',
      } as MessageEntity;

      // Act
      const result = await service.parseMessage(messageEntity);

      // Assert
      expect(result.previewText).toBe('Preview text');
      expect(result.replyTo).toBe('reply@example.com');
      expect(result.priority).toBe('high');
      expect(result.ippool).toBe('pool-1');
    });
  });

  describe('updateContact', () => {
    it('should update contact with provided params', async () => {
      // Arrange
      const mockParams = { firstName: 'Updated', lastName: 'Name' };
      const mockContactId = 123;
      const mockAccountId = 1;
      const queryBuilder = createMockQueryBuilder();
      contactRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      // Act
      await service.updateContact(mockParams, mockContactId, mockAccountId);

      // Assert
      expect(contactRepository.createQueryBuilder).toHaveBeenCalledWith('contacts');
      expect(queryBuilder.update).toHaveBeenCalled();
      expect(queryBuilder.set).toHaveBeenCalledWith(mockParams);
      expect(queryBuilder.where).toHaveBeenCalledWith('id = :contactId AND account_id = :accountId', { contactId: mockContactId, accountId: mockAccountId });
      expect(queryBuilder.execute).toHaveBeenCalled();
    });

    it('should update single field', async () => {
      // Arrange
      const mockParams = { email: 'newemail@example.com' };
      const queryBuilder = createMockQueryBuilder();
      contactRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      // Act
      await service.updateContact(mockParams, 456, 2);

      // Assert
      expect(queryBuilder.set).toHaveBeenCalledWith(mockParams);
    });
  });

  describe('createOrUpdateCustomFields', () => {
    it('should insert or update custom fields', async () => {
      // Arrange
      const mockCustomFields = [{ accountId: 1, contactId: 123, customFieldId: 5, value: 'Test Value' } as ContactCustomFieldEntity];
      const queryBuilder = createMockQueryBuilder();
      contactCustomFieldsRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      // Act
      await service.createOrUpdateCustomFields(mockCustomFields);

      // Assert
      expect(contactCustomFieldsRepository.createQueryBuilder).toHaveBeenCalledWith('contact_custom_field');
      expect(queryBuilder.insert).toHaveBeenCalled();
      expect(queryBuilder.values).toHaveBeenCalledWith(mockCustomFields);
      expect(queryBuilder.orUpdate).toHaveBeenCalledWith(['value'], ['account_id', 'contact_id', 'custom_field_id']);
      expect(queryBuilder.execute).toHaveBeenCalled();
    });

    it('should handle multiple custom fields', async () => {
      // Arrange
      const mockCustomFields = [
        { accountId: 1, contactId: 123, customFieldId: 1, value: 'Value 1' } as ContactCustomFieldEntity,
        { accountId: 1, contactId: 123, customFieldId: 2, value: 'Value 2' } as ContactCustomFieldEntity,
        { accountId: 1, contactId: 123, customFieldId: 3, value: 'Value 3' } as ContactCustomFieldEntity,
      ];
      const queryBuilder = createMockQueryBuilder();
      contactCustomFieldsRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      // Act
      await service.createOrUpdateCustomFields(mockCustomFields);

      // Assert
      expect(queryBuilder.values).toHaveBeenCalledWith(mockCustomFields);
    });
  });

  describe('queryRunner', () => {
    it('should execute raw SQL query', async () => {
      // Arrange
      const mockQuery = 'SELECT * FROM contacts WHERE account_id = 1';
      const mockResult = [{ id: 1, email: 'test@example.com' }];
      entityManager.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.queryRunner(mockQuery);

      // Assert
      expect(entityManager.query).toHaveBeenCalledWith(mockQuery);
      expect(result).toEqual(mockResult);
    });

    it('should handle complex queries', async () => {
      // Arrange
      const complexQuery = `
        SELECT c.*, COUNT(ca.id) as automation_count
        FROM contacts c
        LEFT JOIN contact_automations ca ON c.id = ca.contact_id
        WHERE c.account_id = 1
        GROUP BY c.id
        HAVING automation_count > 0
      `;
      const mockResult = [{ id: 1, email: 'test@example.com', automation_count: 5 }];
      entityManager.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.queryRunner(complexQuery);

      // Assert
      expect(entityManager.query).toHaveBeenCalledWith(complexQuery);
      expect(result).toEqual(mockResult);
    });

    it('should return empty array for queries with no results', async () => {
      // Arrange
      const mockQuery = 'SELECT * FROM contacts WHERE id = 999999';
      entityManager.query.mockResolvedValue([]);

      // Act
      const result = await service.queryRunner(mockQuery);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
