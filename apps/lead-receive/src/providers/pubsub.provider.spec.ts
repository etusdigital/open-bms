import { PubSubProvider } from './pubsub.provider';
import { createLeadMessage } from '../__mocks__/test-fixtures';

// Mock the PubSub module
jest.mock('@google-cloud/pubsub', () => {
  const mockPublishMessage = jest.fn().mockResolvedValue('mock-message-id');
  const mockTopic = jest.fn().mockReturnValue({
    publishMessage: mockPublishMessage,
  });
  return {
    PubSub: jest.fn().mockImplementation(() => ({
      topic: mockTopic,
    })),
    Topic: jest.fn(),
    __mockPublishMessage: mockPublishMessage,
    __mockTopic: mockTopic,
  };
});

describe('PubSubProvider', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.TOPIC_NAME_LEAD_CONCEPTION = 'test-topic';
    process.env.SERVICE_ACCOUNT = JSON.stringify({
      type: 'service_account',
      project_id: 'test',
      private_key_id: 'key-id',
      private_key: 'key',
      client_email: 'test@test.iam.gserviceaccount.com',
      client_id: '123',
      auth_uri: 'https://auth.example.com',
      token_uri: 'https://token.example.com',
      auth_provider_x509_cert_url: 'https://certs.example.com',
      client_x509_cert_url: 'https://certs.example.com/test',
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should throw when TOPIC_NAME_LEAD_CONCEPTION is not defined', () => {
      delete process.env.TOPIC_NAME_LEAD_CONCEPTION;
      expect(() => new PubSubProvider()).toThrow('TOPIC_NAME_LEAD_CONCEPTION is not defined');
    });

    it('should not throw when SERVICE_ACCOUNT is not defined', () => {
      delete process.env.SERVICE_ACCOUNT;
      const { PubSub: MockPubSub } = jest.requireMock('@google-cloud/pubsub');
      expect(() => new PubSubProvider()).not.toThrow();
      expect(MockPubSub).toHaveBeenCalledWith({});
    });

    it('should throw when SERVICE_ACCOUNT is invalid JSON', () => {
      jest.spyOn(console, 'error').mockImplementation();
      process.env.SERVICE_ACCOUNT = 'invalid-json';
      expect(() => new PubSubProvider()).toThrow('Invalid SERVICE_ACCOUNT format');
    });

    it('should create instance with valid env vars', () => {
      const provider = new PubSubProvider();
      expect(provider).toBeDefined();
    });
  });

  describe('sendMessage', () => {
    it('should return mock message in non-production environment', async () => {
      process.env.NODE_ENV = 'development';
      const provider = new PubSubProvider();
      const message = createLeadMessage();

      const result = await provider.sendMessage(message);

      expect(result).toHaveProperty('messageId');
      expect(result).toHaveProperty('message');
      expect(result.status).toBe(true);
    });

    it('should publish to PubSub in production environment', async () => {
      process.env.NODE_ENV = 'production';
      const provider = new PubSubProvider();
      const message = createLeadMessage();

      const result = await provider.sendMessage(message, { type: 'lead' });

      expect(result.messageId).toBe('mock-message-id');
      expect(result.status).toBe(true);
    });

    it('should add Content-Type to attributes in production', async () => {
      process.env.NODE_ENV = 'production';
      const provider = new PubSubProvider();
      const message = createLeadMessage();
      const attrs = { type: 'lead' };

      await provider.sendMessage(message, attrs);

      expect(attrs).toHaveProperty('Content-Type', 'application/json');
    });

    it('should use empty attributes by default', async () => {
      process.env.NODE_ENV = 'development';
      const provider = new PubSubProvider();
      const message = createLeadMessage();

      const result = await provider.sendMessage(message);

      expect(result.status).toBe(true);
    });

    it('should throw when PubSub publish fails in production', async () => {
      process.env.NODE_ENV = 'production';
      const { __mockPublishMessage } = jest.requireMock('@google-cloud/pubsub');
      __mockPublishMessage.mockRejectedValueOnce(new Error('Publish failed'));

      const provider = new PubSubProvider();
      const message = createLeadMessage();

      await expect(provider.sendMessage(message)).rejects.toThrow('Error to send message to');
    });

    it('should generate unique message IDs in non-production', async () => {
      process.env.NODE_ENV = 'development';
      const provider = new PubSubProvider();
      const message = createLeadMessage();

      const result1 = await provider.sendMessage(message);
      const result2 = await provider.sendMessage(message);

      expect(result1.messageId).not.toBe(result2.messageId);
    });

    it('should include message ID in the message field', async () => {
      process.env.NODE_ENV = 'development';
      const provider = new PubSubProvider();
      const message = createLeadMessage();

      const result = await provider.sendMessage(message);

      expect(result.message).toContain(result.messageId);
      expect(result.message).toContain('published');
    });
  });
});
