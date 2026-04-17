import { PubSubProvider } from './pubsub.provider';
import { PubSub, Topic } from '@google-cloud/pubsub';

// Mock do módulo @google-cloud/pubsub
jest.mock('@google-cloud/pubsub');

describe('PubSubProvider', () => {
  let provider: PubSubProvider;
  let mockTopic: jest.Mocked<Topic>;
  let mockTopic2: jest.Mocked<Topic>;
  let mockPubSub: jest.Mocked<PubSub>;

  beforeEach(() => {
    // Mock dos topics
    mockTopic = {
      publishMessage: jest.fn().mockResolvedValue('message-id-123'),
    } as any;

    mockTopic2 = {
      publishMessage: jest.fn().mockResolvedValue('message-id-456'),
    } as any;

    // Mock do PubSub que retorna os topics mockados
    mockPubSub = {
      topic: jest.fn((topicName: string) => {
        if (topicName === 'msgops-email-errors') {
          return mockTopic2;
        }
        return mockTopic;
      }),
    } as any;

    // Configura o mock do construtor do PubSub
    (PubSub as jest.MockedClass<typeof PubSub>).mockImplementation(() => mockPubSub);

    // Configura variável de ambiente para SERVICE_ACCOUNT
    process.env.SERVICE_ACCOUNT = JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key: 'test-key',
      client_email: 'test@test.com',
    });

    // Cria a instância do provider
    provider = new PubSubProvider('test-topic');
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.SERVICE_ACCOUNT;
    delete process.env.NODE_ENV;
  });

  describe('constructor', () => {
    it('should initialize with correct topic names', () => {
      expect(PubSub).toHaveBeenCalledWith({
        credentials: {
          type: 'service_account',
          project_id: 'test-project',
          private_key: 'test-key',
          client_email: 'test@test.com',
        },
      });
      expect(mockPubSub.topic).toHaveBeenCalledWith('test-topic');
      expect(mockPubSub.topic).toHaveBeenCalledWith('msgops-email-errors');
    });

    it('should create clientTopic and clientTopic2', () => {
      expect(provider.clientTopic).toBe(mockTopic);
      expect(provider.clientTopic2).toBe(mockTopic2);
    });

    it('should handle empty SERVICE_ACCOUNT env var', () => {
      delete process.env.SERVICE_ACCOUNT;

      const providerWithoutCredentials = new PubSubProvider('test-topic-2');

      expect(PubSub).toHaveBeenCalledWith({
        credentials: {},
      });
      expect(providerWithoutCredentials.clientTopic).toBeDefined();
    });
  });

  describe('sendAsyncMessage', () => {
    it('should return random hex string in non-production environment', async () => {
      process.env.NODE_ENV = 'development';

      const result = await provider.sendAsyncMessage({ test: 'data' });

      expect(result).toMatch(/^[a-f0-9]{40}$/); // 20 bytes = 40 hex chars
      expect(mockTopic.publishMessage).not.toHaveBeenCalled();
    });

    it('should publish message to PubSub in production environment', async () => {
      process.env.NODE_ENV = 'production';
      const message = { test: 'data', value: 123 };

      const result = await provider.sendAsyncMessage(message);

      expect(result).toBe('message-id-123');
      expect(mockTopic.publishMessage).toHaveBeenCalledWith({
        json: message,
        attributes: { 'Content-Type': 'application/json' },
      });
    });

    it('should include custom attributes in production environment', async () => {
      process.env.NODE_ENV = 'production';
      const message = { test: 'data' };
      const customAttributes = {
        customKey: 'customValue',
        anotherKey: 'anotherValue',
      };

      await provider.sendAsyncMessage(message, customAttributes);

      expect(mockTopic.publishMessage).toHaveBeenCalledWith({
        json: message,
        attributes: {
          customKey: 'customValue',
          anotherKey: 'anotherValue',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should override Content-Type if provided in custom attributes', async () => {
      process.env.NODE_ENV = 'production';
      const message = { test: 'data' };
      const customAttributes = {
        'Content-Type': 'text/plain',
      };

      await provider.sendAsyncMessage(message, customAttributes);

      expect(mockTopic.publishMessage).toHaveBeenCalledWith({
        json: message,
        attributes: {
          'Content-Type': 'application/json', // Always overridden
        },
      });
    });
  });

  describe('sendAsyncMessage2', () => {
    it('should return random hex string in non-production environment', async () => {
      process.env.NODE_ENV = 'development';

      const result = await provider.sendAsyncMessage2({ error: 'test error' });

      expect(result).toMatch(/^[a-f0-9]{40}$/); // 20 bytes = 40 hex chars
      expect(mockTopic2.publishMessage).not.toHaveBeenCalled();
    });

    it('should publish message to error topic in production environment', async () => {
      process.env.NODE_ENV = 'production';
      const errorMessage = { error: 'test error', code: 500 };

      const result = await provider.sendAsyncMessage2(errorMessage);

      expect(result).toBe('message-id-456');
      expect(mockTopic2.publishMessage).toHaveBeenCalledWith({
        json: errorMessage,
        attributes: { 'Content-Type': 'application/json' },
      });
    });

    it('should include custom attributes for error messages in production', async () => {
      process.env.NODE_ENV = 'production';
      const errorMessage = { error: 'test error' };
      const customAttributes = {
        severity: 'high',
        source: 'email-service',
      };

      await provider.sendAsyncMessage2(errorMessage, customAttributes);

      expect(mockTopic2.publishMessage).toHaveBeenCalledWith({
        json: errorMessage,
        attributes: {
          severity: 'high',
          source: 'email-service',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should use different topic than sendAsyncMessage', async () => {
      process.env.NODE_ENV = 'production';

      await provider.sendAsyncMessage({ test: 'regular message' });
      await provider.sendAsyncMessage2({ test: 'error message' });

      expect(mockTopic.publishMessage).toHaveBeenCalledTimes(1);
      expect(mockTopic2.publishMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('environment handling', () => {
    it('should treat undefined NODE_ENV as non-production', async () => {
      delete process.env.NODE_ENV;

      const result = await provider.sendAsyncMessage({ test: 'data' });

      expect(result).toMatch(/^[a-f0-9]{40}$/);
      expect(mockTopic.publishMessage).not.toHaveBeenCalled();
    });

    it('should treat test NODE_ENV as non-production', async () => {
      process.env.NODE_ENV = 'test';

      const result = await provider.sendAsyncMessage({ test: 'data' });

      expect(result).toMatch(/^[a-f0-9]{40}$/);
      expect(mockTopic.publishMessage).not.toHaveBeenCalled();
    });

    it('should only publish in production NODE_ENV', async () => {
      process.env.NODE_ENV = 'production';

      const result = await provider.sendAsyncMessage({ test: 'data' });

      expect(result).toBe('message-id-123');
      expect(mockTopic.publishMessage).toHaveBeenCalled();
    });
  });
});
