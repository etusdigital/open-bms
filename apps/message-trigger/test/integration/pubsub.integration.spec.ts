import { PubSubProvider } from '../../src/providers/pubsub.provider';
import { PubSub } from '@google-cloud/pubsub';
import { CompressedPayload, ClickHousePayload } from '../../src/interfaces';

describe('Pub/Sub Integration Tests', () => {
  let provider: PubSubProvider;
  let mockPubSubClient: any;
  let mockTopic: any;
  let mockRedisService: any;

  const originalEnv = process.env;

  beforeAll(() => {
    // Setup test environment variables
    process.env = {
      ...originalEnv,
      SERVICE_ACCOUNT: JSON.stringify({
        type: 'service_account',
        project_id: 'test-project',
        private_key: 'fake-private-key',
        client_email: 'test@test-project.iam.gserviceaccount.com',
      }),
      TOPIC_NAME_EVENT_PROCESS: 'msgops-internal-events',
      TOPIC_NAME_MESSAGE_TRIGGER: 'msgops.message.trigger',
      TOPIC_NAME_SEND_EMAIL: 'msgops.send.email',
      TOPIC_NAME_SEND_PUSH: 'msgops.send.push',
      NODE_ENV: 'production', // Test in production mode
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    // Create mock Topic
    mockTopic = {
      publishMessage: jest.fn(),
      name: 'projects/test-project/topics/test-topic',
    };

    // Create mock PubSub client
    mockPubSubClient = {
      topic: jest.fn().mockReturnValue(mockTopic),
    };

    // Mock RedisService
    mockRedisService = {
      getOrThrow: jest.fn().mockReturnValue({
        set: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
      }),
    };

    // Mock PubSub constructor
    jest.spyOn(PubSub.prototype, 'topic').mockImplementation(mockPubSubClient.topic);

    provider = new PubSubProvider(mockRedisService);

    // Override private client property
    provider.client = mockPubSubClient as any;
    provider.internlEventTopic = mockTopic as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PubSubProvider - sendAsyncMessage', () => {
    it('should publish message to specified topic', async () => {
      // Arrange
      const topicName = 'msgops.send.email';
      const message = {
        automation: { id: 100, name: 'test' },
        contact: { id: 500, email: 'test@example.com' },
      };
      const compressPayload: CompressedPayload = null;
      const mockMessageId = 'message-id-12345';

      mockTopic.publishMessage.mockResolvedValue([mockMessageId]);

      // Act
      const result = await provider.sendAsyncMessage(topicName, message, compressPayload);

      // Assert
      expect(result).toBe(mockMessageId);
      expect(mockPubSubClient.topic).toHaveBeenCalledWith(topicName);
      expect(mockTopic.publishMessage).toHaveBeenCalledTimes(1);
    });

    it('should include message as JSON in publishMessage call', async () => {
      // Arrange
      const topicName = 'msgops.message.trigger';
      const message = {
        id: 'lead-123',
        automation: { id: 200 },
        contact: { email: 'json@test.com' },
      };
      const mockMessageId = 'msg-json-123';

      mockTopic.publishMessage.mockResolvedValue([mockMessageId]);

      // Act
      await provider.sendAsyncMessage(topicName, message, null);

      // Assert
      const publishCall = mockTopic.publishMessage.mock.calls[0][0];
      expect(publishCall).toHaveProperty('json');
      expect(publishCall.json).toEqual(message);
    });

    it('should include Content-Type attribute', async () => {
      // Arrange
      const topicName = 'test-topic';
      const message = { test: 'data' };
      mockTopic.publishMessage.mockResolvedValue(['msg-attr']);

      // Act
      await provider.sendAsyncMessage(topicName, message, null);

      // Assert
      const publishCall = mockTopic.publishMessage.mock.calls[0][0];
      expect(publishCall.attributes).toHaveProperty('Content-Type');
      expect(publishCall.attributes['Content-Type']).toBe('application/json');
    });

    it('should include custom attributes', async () => {
      // Arrange
      const topicName = 'test-topic';
      const message = { test: 'custom-attrs' };
      const customAttributes = {
        type: 'email',
        priority: 'high',
        source: 'automation',
      };
      mockTopic.publishMessage.mockResolvedValue(['msg-custom-attrs']);

      // Act
      await provider.sendAsyncMessage(topicName, message, null, customAttributes);

      // Assert
      const publishCall = mockTopic.publishMessage.mock.calls[0][0];
      expect(publishCall.attributes).toMatchObject({
        'Content-Type': 'application/json',
        type: 'email',
        priority: 'high',
        source: 'automation',
      });
    });

    it('should merge custom attributes with Content-Type', async () => {
      // Arrange
      const topicName = 'test-topic';
      const message = { test: 'merge' };
      const customAttributes = { 'X-Custom-Header': 'value' };
      mockTopic.publishMessage.mockResolvedValue(['msg-merge']);

      // Act
      await provider.sendAsyncMessage(topicName, message, null, customAttributes);

      // Assert
      const publishCall = mockTopic.publishMessage.mock.calls[0][0];
      expect(publishCall.attributes['Content-Type']).toBe('application/json');
      expect(publishCall.attributes['X-Custom-Header']).toBe('value');
    });

    it('should return messageId from Pub/Sub', async () => {
      // Arrange
      const topicName = 'test-topic';
      const message = { test: 'return-id' };
      const expectedMessageId = 'unique-message-id-xyz789';
      mockTopic.publishMessage.mockResolvedValue([expectedMessageId]);

      // Act
      const result = await provider.sendAsyncMessage(topicName, message, null);

      // Assert
      expect(result).toBe(expectedMessageId);
    });

    it('should handle complex nested message payloads', async () => {
      // Arrange
      const topicName = 'test-topic';
      const complexMessage = {
        automation: {
          id: 300,
          name: 'complex-automation',
          steps: [
            { id: 1, type: 'email', settings: { subject: 'Test' } },
            { id: 2, type: 'wait', settings: { minutes: 60 } },
          ],
        },
        contact: {
          id: 600,
          email: 'complex@example.com',
          customFields: [
            { key: 'field1', value: 'value1' },
            { key: 'field2', value: 'value2' },
          ],
        },
        metadata: {
          startedAt: 1234567890,
          source: 'api',
        },
      };
      mockTopic.publishMessage.mockResolvedValue(['msg-complex']);

      // Act
      await provider.sendAsyncMessage(topicName, complexMessage, null);

      // Assert
      const publishCall = mockTopic.publishMessage.mock.calls[0][0];
      expect(publishCall.json).toEqual(complexMessage);
      expect(publishCall.json.automation.steps).toHaveLength(2);
      expect(publishCall.json.contact.customFields).toHaveLength(2);
    });

    it('should handle messages with special characters', async () => {
      // Arrange
      const topicName = 'test-topic';
      const messageWithSpecialChars = {
        text: 'Hello "World" with\nnewlines\tand\ttabs',
        emoji: '😊🎉',
        unicode: 'Olá, 你好',
        email: 'user+tag@example.com',
      };
      mockTopic.publishMessage.mockResolvedValue(['msg-special']);

      // Act
      await provider.sendAsyncMessage(topicName, messageWithSpecialChars, null);

      // Assert
      const publishCall = mockTopic.publishMessage.mock.calls[0][0];
      expect(publishCall.json).toEqual(messageWithSpecialChars);
    });

    it('should handle Pub/Sub errors', async () => {
      // Arrange
      const topicName = 'test-topic';
      const message = { test: 'error' };
      const pubsubError = new Error('Topic not found');
      mockTopic.publishMessage.mockRejectedValue(pubsubError);

      // Act & Assert
      await expect(provider.sendAsyncMessage(topicName, message, null)).rejects.toThrow('Topic not found');
    });
  });

  describe('PubSubProvider - sendMessageInternalEvent', () => {
    it('should publish internal event with correct structure', async () => {
      // Arrange
      const payload: ClickHousePayload = {
        accountId: 1,
        event: 'automation_step',
        timestamp: 1234567890,
        contactId: 500,
        automationId: 100,
        messageId: 10,
        email: 'internal@test.com',
      };
      const mockMessageId = 'internal-msg-123';
      mockTopic.publishMessage.mockResolvedValue(mockMessageId);

      // Act
      const result = await provider.sendMessageInternalEvent(payload);

      // Assert
      expect(result).toEqual({
        messageId: mockMessageId,
        message: `Message ${mockMessageId} published.`,
        status: true,
      });
    });

    it('should wrap payload in array with platform internal', async () => {
      // Arrange
      const payload: ClickHousePayload = {
        accountId: 1,
        event: 'test_event',
        timestamp: Date.now(),
        contactId: 700,
      };
      mockTopic.publishMessage.mockResolvedValue('msg-wrap');

      // Act
      await provider.sendMessageInternalEvent(payload);

      // Assert
      const publishCall = mockTopic.publishMessage.mock.calls[0][0];
      expect(publishCall.json).toEqual({
        payload: [payload],
        platform: 'internal',
      });
    });

    it('should include Content-Type attribute in internal events', async () => {
      // Arrange
      const payload: ClickHousePayload = {
        accountId: 1,
        event: 'content_type_test',
        timestamp: Date.now(),
      };
      mockTopic.publishMessage.mockResolvedValue('msg-content-type');

      // Act
      await provider.sendMessageInternalEvent(payload);

      // Assert
      const publishCall = mockTopic.publishMessage.mock.calls[0][0];
      expect(publishCall.attributes['Content-Type']).toBe('application/json');
    });

    it('should include custom attributes in internal events', async () => {
      // Arrange
      const payload: ClickHousePayload = {
        accountId: 1,
        event: 'custom_attrs_event',
        timestamp: Date.now(),
      };
      const customAttributes = {
        priority: 'high',
        source: 'automation',
      };
      mockTopic.publishMessage.mockResolvedValue('msg-custom');

      // Act
      await provider.sendMessageInternalEvent(payload, customAttributes);

      // Assert
      const publishCall = mockTopic.publishMessage.mock.calls[0][0];
      expect(publishCall.attributes).toMatchObject({
        'Content-Type': 'application/json',
        priority: 'high',
        source: 'automation',
      });
    });

    it('should use internlEventTopic for publishing', async () => {
      // Arrange
      const payload: ClickHousePayload = {
        accountId: 1,
        event: 'use_topic_test',
        timestamp: Date.now(),
      };
      const mockMessageId = 'msg-topic-test';
      mockTopic.publishMessage.mockResolvedValue(mockMessageId);

      // Act
      await provider.sendMessageInternalEvent(payload);

      // Assert
      expect(mockTopic.publishMessage).toHaveBeenCalledTimes(1);
      expect(mockTopic.name).toBeDefined();
    });

    it('should throw error when internal event publishing fails', async () => {
      // Arrange
      const payload: ClickHousePayload = {
        accountId: 1,
        event: 'error_event',
        timestamp: Date.now(),
      };
      const pubsubError = new Error('Publishing failed');
      mockTopic.publishMessage.mockRejectedValue(pubsubError);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act & Assert
      await expect(provider.sendMessageInternalEvent(payload)).rejects.toThrow('Error to send internal message to');
      expect(consoleErrorSpy).toHaveBeenCalledWith(pubsubError);

      consoleErrorSpy.mockRestore();
    });

    it('should include payload in error message', async () => {
      // Arrange
      const payload: ClickHousePayload = {
        accountId: 1,
        event: 'payload_in_error',
        timestamp: 1234567890,
        contactId: 999,
      };
      mockTopic.publishMessage.mockRejectedValue(new Error('Test error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act & Assert
      try {
        await provider.sendMessageInternalEvent(payload);
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toContain('Error to send internal message to');
        expect(error.message).toContain(JSON.stringify(payload));
      }

      consoleErrorSpy.mockRestore();
    });

    it('should handle complex payload objects', async () => {
      // Arrange
      const complexPayload: ClickHousePayload = {
        accountId: 1,
        event: 'complex_event',
        timestamp: Date.now(),
        contactId: 800,
        automationId: 150,
        properties: {
          step_name: 'Send Email',
          message_id: 200,
          utm_campaign: 'test_campaign',
        },
      };
      mockTopic.publishMessage.mockResolvedValue('msg-complex-payload');

      // Act
      await provider.sendMessageInternalEvent(complexPayload);

      // Assert
      const publishCall = mockTopic.publishMessage.mock.calls[0][0];
      expect(publishCall.json.payload[0]).toEqual(complexPayload);
      expect(publishCall.json.payload[0].properties).toBeDefined();
    });
  });

  describe('Non-Production Environment', () => {
    it('should return mock messageId in non-production for sendAsyncMessage', async () => {
      // Arrange
      process.env.NODE_ENV = 'test';
      const testProvider = new PubSubProvider(mockRedisService);
      const message = { test: 'non-prod' };

      // Act
      const result = await testProvider.sendAsyncMessage('test-topic', message, null);

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBe(40); // crypto.randomBytes(20).toString('hex')
      expect(mockTopic.publishMessage).not.toHaveBeenCalled();

      // Restore environment
      process.env.NODE_ENV = 'production';
    });

    it('should return mock messageId in non-production for sendMessageInternalEvent', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const devProvider = new PubSubProvider(mockRedisService);
      const payload: ClickHousePayload = {
        accountId: 1,
        event: 'dev_event',
        timestamp: Date.now(),
      };

      // Act
      const result = await devProvider.sendMessageInternalEvent(payload);

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect((result as string).length).toBe(40);
      expect(mockTopic.publishMessage).not.toHaveBeenCalled();

      // Restore environment
      process.env.NODE_ENV = 'production';
    });

    it('should generate different mock IDs for consecutive calls', async () => {
      // Arrange
      process.env.NODE_ENV = 'test';
      const testProvider = new PubSubProvider(mockRedisService);
      const message = { test: 'consecutive' };

      // Act
      const result1 = await testProvider.sendAsyncMessage('topic1', message, null);
      const result2 = await testProvider.sendAsyncMessage('topic2', message, null);

      // Assert
      expect(result1).not.toBe(result2);

      // Restore environment
      process.env.NODE_ENV = 'production';
    });
  });

  describe('Topic Selection', () => {
    it('should create topic reference for specified topic name', async () => {
      // Arrange
      const topicName = 'msgops.send.email';
      const message = { test: 'topic-selection' };
      mockTopic.publishMessage.mockResolvedValue(['msg-topic-sel']);

      // Act
      await provider.sendAsyncMessage(topicName, message, null);

      // Assert
      expect(mockPubSubClient.topic).toHaveBeenCalledWith(topicName);
    });

    it('should handle different topic names', async () => {
      // Arrange
      const topics = ['msgops.message.trigger', 'msgops.send.email', 'msgops.send.push', 'msgops.tag-process'];
      const message = { test: 'multi-topic' };
      mockTopic.publishMessage.mockResolvedValue(['msg-multi']);

      // Act & Assert
      for (const topicName of topics) {
        await provider.sendAsyncMessage(topicName, message, null);
        expect(mockPubSubClient.topic).toHaveBeenCalledWith(topicName);
      }
    });
  });

  describe('Message ID Handling', () => {
    it('should extract messageId from array response', async () => {
      // Arrange
      const topicName = 'test-topic';
      const message = { test: 'message-id-extraction' };
      const expectedMessageId = 'extracted-msg-id-abc123';
      mockTopic.publishMessage.mockResolvedValue([expectedMessageId, { metadata: 'extra' }]);

      // Act
      const result = await provider.sendAsyncMessage(topicName, message, null);

      // Assert
      expect(result).toBe(expectedMessageId);
    });

    it('should return messageId that can be used for tracking', async () => {
      // Arrange
      const topicName = 'tracking-topic';
      const message = { test: 'tracking' };
      const messageId = 'tracking-msg-id-123';
      mockTopic.publishMessage.mockResolvedValue([messageId]);

      // Act
      const result = await provider.sendAsyncMessage(topicName, message, null);

      // Assert
      expect(result).toBe(messageId);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
