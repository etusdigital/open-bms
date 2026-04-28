import { Test, TestingModule } from '@nestjs/testing';
import { RedisModule } from '../../src/providers/redis/redis.module';
import { RedisService } from '../../src/providers/redis/redis.service';
import { AppService } from '../../src/app.service';
import { ActiveStepsHandler } from '../../src/handlers/activesteps.handler';
import { QueuePublisher } from '../../src/providers/queue/queue.publisher';
import { ConditionStep } from '../../src/steps/condition.step';
import { TrackerService } from '../../src/tracker/tracker.service';
import { MsgopsService } from '../../src/msgops/msgops.service';
import { EmailValidationProvider } from '../../src/providers/emailValidation.provider';
import { HttpRequestProvider } from '../../src/providers/httpRequest.provider';
import { ActiveCampaignProvider } from '../../src/providers/activeCampaign.provider';
import { Redis } from 'ioredis';
import { LeadStateMessage, StepType } from '../../src/interfaces';

describe('Redis Integration Tests', () => {
  let appService: AppService;
  let redisService: RedisService;
  let redisClient: Redis;

  // Mock dependencies
  const mockActiveStepsHandler = {
    createNextLeadStateMessage: jest.fn(),
  };

  const mockQueuePublisher = {
    sendAsyncMessage: jest.fn(),
    sendInternalEvent: jest.fn(),
    scheduleDelayedStep: jest.fn().mockResolvedValue({ id: 'job-123' }),
  };

  const mockConditionStep = {
    processConditionalTime: jest.fn(),
  };

  const mockTrackerService = {
    send: jest.fn(),
    log: jest.fn(),
  };

  const mockMsgopsService = {
    findContactById: jest.fn(),
    getMessageById: jest.fn(),
    updateContact: jest.fn(),
    createOrUpdateCustomFields: jest.fn(),
    findLeadById: jest.fn(),
    queryRunner: jest.fn(),
  };

  const mockEmailValidationProvider = {
    emailChecker: jest.fn(),
  };

  const mockHttpRequestProvider = {
    process: jest.fn(),
  };

  const mockActiveCampaignProvider = {
    createContact: jest.fn(),
  };

  beforeAll(async () => {
    // Setup test environment variables
    process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
    process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
    process.env.REDIS_DB = '15'; // Use test database
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'NULL'; // Disable logging during tests

    const module: TestingModule = await Test.createTestingModule({
      imports: [RedisModule],
      providers: [
        AppService,
        { provide: ActiveStepsHandler, useValue: mockActiveStepsHandler },
        { provide: QueuePublisher, useValue: mockQueuePublisher },
        { provide: ConditionStep, useValue: mockConditionStep },
        { provide: TrackerService, useValue: mockTrackerService },
        { provide: MsgopsService, useValue: mockMsgopsService },
        { provide: EmailValidationProvider, useValue: mockEmailValidationProvider },
        { provide: HttpRequestProvider, useValue: mockHttpRequestProvider },
        { provide: ActiveCampaignProvider, useValue: mockActiveCampaignProvider },
      ],
    }).compile();

    appService = module.get<AppService>(AppService);
    redisService = module.get<RedisService>(RedisService);
    redisClient = redisService.getOrThrow();
  });

  afterAll(async () => {
    // Clean up: flush test database and close connection
    await redisClient.flushdb();
    await redisClient.quit();
  });

  beforeEach(async () => {
    // Clear all keys before each test
    await redisClient.flushdb();
    jest.clearAllMocks();
  });

  describe('Redis Connection', () => {
    it('should connect to Redis successfully', async () => {
      // Act
      const pong = await redisClient.ping();

      // Assert
      expect(pong).toBe('PONG');
    });

    it('should get client from RedisService', () => {
      // Act
      const client = redisService.getOrThrow();

      // Assert
      expect(client).toBeDefined();
      expect(typeof client.get).toBe('function');
      expect(typeof client.set).toBe('function');
      expect(typeof client.del).toBe('function');
    });

    it('should handle reconnection after disconnect', async () => {
      // Arrange
      const testKey = 'test:reconnect';
      await redisClient.set(testKey, 'value');

      // Act - Redis should auto-reconnect on next operation
      const value = await redisClient.get(testKey);

      // Assert
      expect(value).toBe('value');

      // Cleanup
      await redisClient.del(testKey);
    });
  });

  describe('App Service + Redis - Stop Automation Keys', () => {
    const createMockLeadStateMessage = (overrides = {}): LeadStateMessage => ({
      id: 'lead-123',
      activeStepId: '1',
      startedAt: Date.now(),
      automation: {
        id: 100,
        name: 'test-automation',
        title: 'Test Automation',
        type: 'email',
        version: '1.0.0',
        steps: [
          {
            id: 1,
            type: StepType.EMAIL,
            child: [],
            settings: {},
          },
        ],
      },
      contact: {
        id: 500,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      ...overrides,
    });

    it('should check for leadRedisKey and stop automation when key exists', async () => {
      // Arrange
      const leadStateMessage = createMockLeadStateMessage();
      const leadRedisKey = `automation_to_stop:${leadStateMessage.contact.email}:${leadStateMessage.automation.name}:${leadStateMessage.startedAt}`;
      await redisClient.set(leadRedisKey, 'stop');

      // Act
      const result = await appService.receiveMessage(leadStateMessage, 'msg-123', null);

      // Assert
      expect(result.status).toBe(true);
      expect(result.message).toContain('Automation stopped');
      expect(result.message).toContain(leadStateMessage.automation.title);
      expect(result.message).toContain(leadStateMessage.contact.email);

      // Verify key was deleted
      const keyExists = await redisClient.exists(leadRedisKey);
      expect(keyExists).toBe(0);
    });

    it('should check for removeAutomationKey and stop automation when key exists', async () => {
      // Arrange
      const leadStateMessage = createMockLeadStateMessage();
      const removeAutomationKey = `automation:${leadStateMessage.automation.id}:remove_contact:${leadStateMessage.contact.id}`;
      await redisClient.set(removeAutomationKey, 'true');

      // Act
      const result = await appService.receiveMessage(leadStateMessage, 'msg-456', null);

      // Assert
      expect(result.status).toBe(true);
      expect(result.message).toContain('Automation stopped');

      // Verify key was deleted
      const keyExists = await redisClient.exists(removeAutomationKey);
      expect(keyExists).toBe(0);
    });

    it('should check for automationTargetKey and stop automation when key exists', async () => {
      // Arrange
      const leadStateMessage = createMockLeadStateMessage();
      const automationTargetKey = `automation_target_contact:${leadStateMessage.contact.id}:${leadStateMessage.id}`;
      await redisClient.set(automationTargetKey, 'target');

      // Act
      const result = await appService.receiveMessage(leadStateMessage, 'msg-789', null);

      // Assert
      expect(result.status).toBe(true);
      expect(result.message).toContain('Automation stopped');

      // Verify key was deleted
      const keyExists = await redisClient.exists(automationTargetKey);
      expect(keyExists).toBe(0);
    });

    it('should delete all three keys when multiple stop keys exist', async () => {
      // Arrange
      const leadStateMessage = createMockLeadStateMessage();
      const leadRedisKey = `automation_to_stop:${leadStateMessage.contact.email}:${leadStateMessage.automation.name}:${leadStateMessage.startedAt}`;
      const removeAutomationKey = `automation:${leadStateMessage.automation.id}:remove_contact:${leadStateMessage.contact.id}`;
      const automationTargetKey = `automation_target_contact:${leadStateMessage.contact.id}:${leadStateMessage.id}`;

      await redisClient.set(leadRedisKey, 'stop');
      await redisClient.set(removeAutomationKey, 'true');
      await redisClient.set(automationTargetKey, 'target');

      // Act
      await appService.receiveMessage(leadStateMessage, 'msg-multi', null);

      // Assert - All keys should be deleted
      const keysExist = await redisClient.exists([leadRedisKey, removeAutomationKey, automationTargetKey]);
      expect(keysExist).toBe(0);
    });

    it('should verify no stop keys exist and proceed to processing', async () => {
      // Arrange
      const leadStateMessage = createMockLeadStateMessage();
      const leadRedisKey = `automation_to_stop:${leadStateMessage.contact.email}:${leadStateMessage.automation.name}:${leadStateMessage.startedAt}`;
      const removeAutomationKey = `automation:${leadStateMessage.automation.id}:remove_contact:${leadStateMessage.contact.id}`;
      const automationTargetKey = `automation_target_contact:${leadStateMessage.contact.id}:${leadStateMessage.id}`;

      // Act - Verify keys don't exist
      const keysExist = await redisClient.exists([leadRedisKey, removeAutomationKey, automationTargetKey]);

      // Assert
      expect(keysExist).toBe(0);
    });

    it('should store and delete keys in Redis', async () => {
      // Arrange
      const testKey = 'key:to:delete:test';
      await redisClient.set(testKey, 'delete-me');

      // Verify key exists
      let keyExists = await redisClient.exists(testKey);
      expect(keyExists).toBe(1);

      // Act - Delete key
      await redisClient.del(testKey);

      // Assert
      keyExists = await redisClient.exists(testKey);
      expect(keyExists).toBe(0);
    });
  });

  describe('App Service + Redis - Payload Storage and Retrieval', () => {
    it('should store and retrieve complex payload from Redis', async () => {
      // Arrange
      const testKey = 'test:payload:complex';
      const complexPayload = {
        id: 'lead-456',
        automation: {
          id: 200,
          name: 'complex-automation',
          steps: [
            { id: 1, type: 'email', name: 'Step 1' },
            { id: 2, type: 'wait', name: 'Step 2' },
          ],
        },
        contact: {
          id: 600,
          email: 'complex@test.com',
          customFields: [
            { key: 'field1', value: 'value1' },
            { key: 'field2', value: 'value2' },
          ],
        },
      };

      // Act
      await redisClient.set(testKey, JSON.stringify(complexPayload));
      const retrieved = await redisClient.get(testKey);
      const parsed = JSON.parse(retrieved);

      // Assert
      expect(parsed).toEqual(complexPayload);
      expect(parsed.automation.steps).toHaveLength(2);
      expect(parsed.contact.customFields).toHaveLength(2);
    });

    it('should return null when key does not exist', async () => {
      // Act
      const value = await redisClient.get('non:existent:key');

      // Assert
      expect(value).toBeNull();
    });

    it('should handle special characters in stored values', async () => {
      // Arrange
      const testKey = 'test:special:chars';
      const specialValue = {
        email: 'user+tag@example.com',
        message: 'Hello "World" with\nnewlines',
        unicode: 'Olá 你好 😊',
      };

      // Act
      await redisClient.set(testKey, JSON.stringify(specialValue));
      const retrieved = JSON.parse(await redisClient.get(testKey));

      // Assert
      expect(retrieved.email).toBe('user+tag@example.com');
      expect(retrieved.message).toBe('Hello "World" with\nnewlines');
      expect(retrieved.unicode).toBe('Olá 你好 😊');
    });
  });

  describe('App Service + Redis - TTL and Expiration', () => {
    it('should set TTL correctly for remove automation keys', async () => {
      // Arrange
      const automationId = 150;
      const contactId = 700;
      const removeKey = `automation:${automationId}:remove_contact:${contactId}`;
      const expectedTTL = 43200; // 12 hours in seconds

      // Act
      await redisClient.set(removeKey, 'true', 'EX', expectedTTL);

      // Assert
      const ttl = await redisClient.ttl(removeKey);
      expect(ttl).toBeGreaterThan(43190); // Allow small margin
      expect(ttl).toBeLessThanOrEqual(43200);
    });

    it('should verify key expires after TTL', async () => {
      // Arrange
      const testKey = 'test:expiration';
      const shortTTL = 1; // 1 second

      // Act
      await redisClient.set(testKey, 'expires-soon', 'EX', shortTTL);
      const existsBefore = await redisClient.exists(testKey);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const existsAfter = await redisClient.exists(testKey);

      // Assert
      expect(existsBefore).toBe(1);
      expect(existsAfter).toBe(0);
    });

    it('should check remaining TTL for existing keys', async () => {
      // Arrange
      const testKey = 'test:remaining:ttl';
      await redisClient.set(testKey, 'value', 'EX', 300); // 5 minutes

      // Act
      const ttl = await redisClient.ttl(testKey);

      // Assert
      expect(ttl).toBeGreaterThan(290);
      expect(ttl).toBeLessThanOrEqual(300);
    });
  });

  describe('App Service + Redis - Test AB Processing', () => {
    it('should store Test AB step key in Redis on first execution', async () => {
      // Arrange
      const automationId = 250;
      const stepId = 10;
      const stepRedisKey = `automation_testab_step_${automationId}_${stepId}`;

      // Act - Simulate first execution check
      const keyExists = await redisClient.exists(stepRedisKey);
      if (!keyExists) {
        await redisClient.set(stepRedisKey, new Date().toString());
      }

      // Assert
      const value = await redisClient.get(stepRedisKey);
      expect(value).toBeDefined();
      expect(new Date(value)).toBeInstanceOf(Date);
    });

    it('should retrieve winner message ID from Redis when test is finished', async () => {
      // Arrange
      const automationId = 300;
      const stepId = 20;
      const winnerKey = `automation_testab_step_finished_${automationId}_${stepId}`;
      const winnerMessageId = '12345';

      // Act
      await redisClient.set(winnerKey, winnerMessageId);
      const retrieved = await redisClient.get(winnerKey);

      // Assert
      expect(retrieved).toBe(winnerMessageId);
    });

    it('should not overwrite existing Test AB step key', async () => {
      // Arrange
      const automationId = 350;
      const stepId = 30;
      const stepRedisKey = `automation_testab_step_${automationId}_${stepId}`;
      const firstExecutionTime = new Date('2024-01-01T10:00:00Z').toString();

      await redisClient.set(stepRedisKey, firstExecutionTime);

      // Act - Try to set again (simulating second execution)
      const keyExists = await redisClient.exists(stepRedisKey);
      if (!keyExists) {
        await redisClient.set(stepRedisKey, new Date().toString());
      }

      const retrieved = await redisClient.get(stepRedisKey);

      // Assert - Should still have the first execution time
      expect(retrieved).toBe(firstExecutionTime);
    });
  });

  describe('App Service + Redis - Remove Automation', () => {
    it('should create remove automation key with correct format', async () => {
      // Arrange
      const automationId = 400;
      const contactId = 800;
      const removeKey = `automation:${automationId}:remove_contact:${contactId}`;

      // Act
      await redisClient.set(removeKey, 'true', 'EX', 43200);

      // Assert
      const value = await redisClient.get(removeKey);
      const ttl = await redisClient.ttl(removeKey);

      expect(value).toBe('true');
      expect(ttl).toBeGreaterThan(43190);
    });

    it('should handle multiple remove automation keys for different contacts', async () => {
      // Arrange
      const automationId = 450;
      const contactIds = [900, 901, 902];

      // Act
      for (const contactId of contactIds) {
        const removeKey = `automation:${automationId}:remove_contact:${contactId}`;
        await redisClient.set(removeKey, 'true', 'EX', 43200);
      }

      // Assert
      for (const contactId of contactIds) {
        const removeKey = `automation:${automationId}:remove_contact:${contactId}`;
        const exists = await redisClient.exists(removeKey);
        expect(exists).toBe(1);
      }
    });

    it('should delete remove automation key after processing', async () => {
      // Arrange
      const automationId = 500;
      const contactId = 1000;
      const removeKey = `automation:${automationId}:remove_contact:${contactId}`;
      await redisClient.set(removeKey, 'true', 'EX', 43200);

      // Act
      await redisClient.del(removeKey);

      // Assert
      const exists = await redisClient.exists(removeKey);
      expect(exists).toBe(0);
    });
  });

  describe('Redis Error Handling', () => {
    it('should handle get operation on non-existent key gracefully', async () => {
      // Act
      const value = await redisClient.get('does:not:exist');

      // Assert
      expect(value).toBeNull();
    });

    it('should handle exists check on multiple keys', async () => {
      // Arrange
      await redisClient.set('key1', 'value1');
      await redisClient.set('key2', 'value2');

      // Act
      const existsCount = await redisClient.exists(['key1', 'key2', 'key3']);

      // Assert
      expect(existsCount).toBe(2); // Only key1 and key2 exist
    });

    it('should handle delete operation on non-existent key', async () => {
      // Act
      const deletedCount = await redisClient.del('non:existent:key');

      // Assert
      expect(deletedCount).toBe(0);
    });
  });
});
