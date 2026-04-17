import { Test, TestingModule } from '@nestjs/testing';
import { PubSubProvider } from './pubsub.provider';
import { PubSub } from '@google-cloud/pubsub';
import { RedisService } from './redis/redis.service';
import { ClickHousePayload, CompressedPayload } from '../interfaces';

// Mock @google-cloud/pubsub
jest.mock('@google-cloud/pubsub');

describe('PubSubProvider', () => {
  let provider: PubSubProvider;
  let mockPubSubClient: any;
  let mockTopic: any;
  let mockInternalEventTopic: any;
  let mockRedisService: jest.Mocked<RedisService>;

  const originalEnv = process.env;

  beforeEach(async () => {
    // Reset environment variables
    process.env = {
      ...originalEnv,
      SERVICE_ACCOUNT: JSON.stringify({
        type: 'service_account',
        project_id: 'test-project',
        private_key: 'test-key',
        client_email: 'test@example.com',
      }),
      TOPIC_NAME_EVENT_PROCESS: 'msgops.event.process',
      NODE_ENV: 'test',
    };

    // Mock Topic
    mockTopic = {
      publishMessage: jest.fn().mockResolvedValue(['test-message-id-123']),
    };

    mockInternalEventTopic = {
      publishMessage: jest.fn().mockResolvedValue(['internal-event-id-456']),
    };

    // Mock PubSub client
    mockPubSubClient = {
      topic: jest.fn().mockReturnValue(mockTopic),
    };

    // Mock RedisService
    mockRedisService = {
      getOrThrow: jest.fn(),
    } as any;

    (PubSub as jest.MockedClass<typeof PubSub>).mockImplementation((options?: any) => {
      // Second instance for internal event topic
      if (options && JSON.stringify(options) === JSON.stringify({ credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}') })) {
        const instance = Object.create(mockPubSubClient);
        instance.topic = jest.fn((topicName: string) => {
          if (topicName === 'msgops.event.process') {
            return mockInternalEventTopic;
          }
          return mockTopic;
        });
        return instance;
      }
      return mockPubSubClient;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [PubSubProvider, { provide: RedisService, useValue: mockRedisService }],
    }).compile();

    provider = module.get<PubSubProvider>(PubSubProvider);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should be defined', () => {
      expect(provider).toBeDefined();
    });

    it('should initialize PubSub client with credentials from SERVICE_ACCOUNT', () => {
      expect(PubSub).toHaveBeenCalledWith({
        credentials: {
          type: 'service_account',
          project_id: 'test-project',
          private_key: 'test-key',
          client_email: 'test@example.com',
        },
      });
    });

    it('should initialize internal event topic', () => {
      expect(provider.internlEventTopic).toBeDefined();
    });

    it('should handle empty SERVICE_ACCOUNT gracefully', () => {
      process.env.SERVICE_ACCOUNT = undefined;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- testing constructor side effects
      const newProvider = new PubSubProvider(mockRedisService);
      expect(PubSub).toHaveBeenCalledWith({
        credentials: {},
      });
    });
  });

  describe('sendAsyncMessage', () => {
    const mockMessage = {
      id: 'lead-123',
      automation: { id: 50, type: 'email' },
      contact: { email: 'test@example.com' },
    };
    const mockCompressPayload: CompressedPayload = {
      automationKey: 'automation-50-123-1234567890',
      contactId: 123,
      automationId: 50,
      stepId: 100,
    };

    describe('Non-production environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'test';
      });

      it('should return mock message ID without calling PubSub API', async () => {
        // Act
        const result = await provider.sendAsyncMessage('test-topic', mockMessage, mockCompressPayload);

        // Assert
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBe(40); // crypto.randomBytes(20).toString('hex') = 40 chars
        expect(mockPubSubClient.topic).not.toHaveBeenCalled();
      });

      it('should return different random IDs for subsequent calls', async () => {
        // Act
        const result1 = await provider.sendAsyncMessage('test-topic', mockMessage, mockCompressPayload);
        const result2 = await provider.sendAsyncMessage('test-topic', mockMessage, mockCompressPayload);

        // Assert
        expect(result1).not.toBe(result2);
      });

      it('should work without compressPayload', async () => {
        // Act
        const result = await provider.sendAsyncMessage('test-topic', mockMessage, null);

        // Assert
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      });
    });

    describe('Production environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        // Re-create provider with production env
        provider = new PubSubProvider(mockRedisService);
        // Reset mocks after provider recreation
        jest.clearAllMocks();
      });

      it('should publish message to correct topic', async () => {
        // Act
        const result = await provider.sendAsyncMessage('msgops.message.trigger', mockMessage, mockCompressPayload);

        // Assert
        // The provider.client is the mockPubSubClient instance
        expect(result).toBe('test-message-id-123');
        expect(mockTopic.publishMessage).toHaveBeenCalledWith({
          json: mockMessage,
          attributes: {
            'Content-Type': 'application/json',
          },
        });
      });

      it('should include Content-Type header in attributes', async () => {
        // Act
        await provider.sendAsyncMessage('msgops.send.email', mockMessage, mockCompressPayload);

        // Assert
        expect(mockTopic.publishMessage).toHaveBeenCalledWith({
          json: mockMessage,
          attributes: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        });
      });

      it('should merge custom attributes with default attributes', async () => {
        // Arrange
        const customAttributes = {
          'X-Custom-Header': 'custom-value',
          'X-Request-ID': 'req-123',
        };

        // Act
        await provider.sendAsyncMessage('msgops.send.email', mockMessage, mockCompressPayload, customAttributes);

        // Assert
        expect(mockTopic.publishMessage).toHaveBeenCalledWith({
          json: mockMessage,
          attributes: {
            'Content-Type': 'application/json',
            'X-Custom-Header': 'custom-value',
            'X-Request-ID': 'req-123',
          },
        });
      });

      it('should handle empty custom attributes', async () => {
        // Act
        await provider.sendAsyncMessage('msgops.send.email', mockMessage, mockCompressPayload, {});

        // Assert
        expect(mockTopic.publishMessage).toHaveBeenCalledWith({
          json: mockMessage,
          attributes: {
            'Content-Type': 'application/json',
          },
        });
      });

      it('should send message without compressPayload', async () => {
        // Act
        const result = await provider.sendAsyncMessage('msgops.send.email', mockMessage, null);

        // Assert
        expect(mockTopic.publishMessage).toHaveBeenCalledWith({
          json: mockMessage,
          attributes: {
            'Content-Type': 'application/json',
          },
        });
        expect(result).toBe('test-message-id-123');
      });

      it('should handle complex message payloads', async () => {
        // Arrange
        const complexMessage = {
          ...mockMessage,
          metadata: {
            timestamp: Date.now(),
            source: 'test-service',
            nested: {
              deep: {
                value: 'test',
              },
            },
          },
          array: [1, 2, 3, 4, 5],
        };

        // Act
        await provider.sendAsyncMessage('msgops.send.email', complexMessage, mockCompressPayload);

        // Assert
        expect(mockTopic.publishMessage).toHaveBeenCalledWith({
          json: complexMessage,
          attributes: expect.any(Object),
        });
      });

      it('should handle publishMessage errors', async () => {
        // Arrange
        const error = new Error('PubSub API error');
        mockTopic.publishMessage.mockRejectedValue(error);

        // Act & Assert
        await expect(provider.sendAsyncMessage('msgops.send.email', mockMessage, mockCompressPayload)).rejects.toThrow('PubSub API error');
      });

      it('should return messageId from PubSub response', async () => {
        // Arrange
        mockTopic.publishMessage.mockResolvedValue(['custom-message-id-789']);

        // Act
        const result = await provider.sendAsyncMessage('msgops.send.email', mockMessage, mockCompressPayload);

        // Assert
        expect(result).toBe('custom-message-id-789');
      });
    });

    describe('Edge cases', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        provider = new PubSubProvider(mockRedisService);
      });

      it('should handle null message', async () => {
        // Act
        await provider.sendAsyncMessage('test-topic', null, mockCompressPayload);

        // Assert
        expect(mockTopic.publishMessage).toHaveBeenCalledWith({
          json: null,
          attributes: expect.any(Object),
        });
      });

      it('should handle undefined compressPayload', async () => {
        // Act
        const result = await provider.sendAsyncMessage('test-topic', mockMessage, undefined);

        // Assert
        expect(result).toBe('test-message-id-123');
      });

      it('should handle very large messages', async () => {
        // Arrange
        const largeMessage = {
          data: 'x'.repeat(10000),
          array: Array(1000).fill({ value: 'test' }),
        };

        // Act
        await provider.sendAsyncMessage('test-topic', largeMessage, mockCompressPayload);

        // Assert
        expect(mockTopic.publishMessage).toHaveBeenCalledWith({
          json: largeMessage,
          attributes: expect.any(Object),
        });
      });
    });
  });

  describe('sendMessageInternalEvent', () => {
    const mockPayload: ClickHousePayload = {
      event: 'USER_ACTION',
      timestamp: Date.now(),
      data: {
        userId: 123,
        action: 'click',
      },
    } as any;

    describe('Non-production environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'test';
      });

      it('should return mock message ID without calling PubSub API', async () => {
        // Act
        const result = await provider.sendMessageInternalEvent(mockPayload);

        // Assert
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect((result as string).length).toBe(40); // crypto.randomBytes(20).toString('hex')
        expect(mockInternalEventTopic.publishMessage).not.toHaveBeenCalled();
      });

      it('should return different random IDs for subsequent calls', async () => {
        // Act
        const result1 = await provider.sendMessageInternalEvent(mockPayload);
        const result2 = await provider.sendMessageInternalEvent(mockPayload);

        // Assert
        expect(result1 as string).not.toBe(result2 as string);
      });
    });

    describe('Production environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        provider = new PubSubProvider(mockRedisService);
      });

      it('should publish message to internal event topic', async () => {
        // Act
        const result = await provider.sendMessageInternalEvent(mockPayload);

        // Assert
        expect(mockInternalEventTopic.publishMessage).toHaveBeenCalledWith({
          json: {
            payload: [mockPayload],
            platform: 'internal',
          },
          attributes: {
            'Content-Type': 'application/json',
          },
        });
        expect(result).toEqual({
          messageId: ['internal-event-id-456'],
          message: 'Message internal-event-id-456 published.',
          status: true,
        });
      });

      it('should include Content-Type header in attributes', async () => {
        // Act
        await provider.sendMessageInternalEvent(mockPayload);

        // Assert
        expect(mockInternalEventTopic.publishMessage).toHaveBeenCalledWith({
          json: expect.any(Object),
          attributes: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        });
      });

      it('should merge custom attributes with default attributes', async () => {
        // Arrange
        const customAttributes = {
          'X-Event-Type': 'user-action',
          'X-Source': 'test-service',
        };

        // Act
        await provider.sendMessageInternalEvent(mockPayload, customAttributes);

        // Assert
        expect(mockInternalEventTopic.publishMessage).toHaveBeenCalledWith({
          json: expect.any(Object),
          attributes: {
            'Content-Type': 'application/json',
            'X-Event-Type': 'user-action',
            'X-Source': 'test-service',
          },
        });
      });

      it('should wrap payload in array and add platform', async () => {
        // Act
        await provider.sendMessageInternalEvent(mockPayload);

        // Assert
        expect(mockInternalEventTopic.publishMessage).toHaveBeenCalledWith({
          json: {
            payload: [mockPayload],
            platform: 'internal',
          },
          attributes: expect.any(Object),
        });
      });

      it('should handle publishMessage errors with console.error', async () => {
        // Arrange
        const error = new Error('PubSub internal event error');
        mockInternalEventTopic.publishMessage.mockRejectedValue(error);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Act & Assert
        await expect(provider.sendMessageInternalEvent(mockPayload)).rejects.toThrow(`Error to send internal message to. ${JSON.stringify(mockPayload)}`);
        expect(consoleErrorSpy).toHaveBeenCalledWith(error);

        consoleErrorSpy.mockRestore();
      });

      it('should return status object with messageId', async () => {
        // Arrange
        mockInternalEventTopic.publishMessage.mockResolvedValue(['event-id-999']);

        // Act
        const result = await provider.sendMessageInternalEvent(mockPayload);

        // Assert
        expect(result).toEqual({
          messageId: ['event-id-999'],
          message: 'Message event-id-999 published.',
          status: true,
        });
      });
    });

    describe('Edge cases', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        provider = new PubSubProvider(mockRedisService);
      });

      it('should handle empty custom attributes', async () => {
        // Act
        await provider.sendMessageInternalEvent(mockPayload, {});

        // Assert
        expect(mockInternalEventTopic.publishMessage).toHaveBeenCalledWith({
          json: expect.any(Object),
          attributes: {
            'Content-Type': 'application/json',
          },
        });
      });

      it('should handle complex payload structures', async () => {
        // Arrange
        const complexPayload: any = {
          event: 'COMPLEX_EVENT',
          nested: {
            deep: {
              structure: {
                value: 'test',
              },
            },
          },
          array: [1, 2, 3],
        };

        // Act
        await provider.sendMessageInternalEvent(complexPayload);

        // Assert
        expect(mockInternalEventTopic.publishMessage).toHaveBeenCalledWith({
          json: {
            payload: [complexPayload],
            platform: 'internal',
          },
          attributes: expect.any(Object),
        });
      });
    });
  });
});
