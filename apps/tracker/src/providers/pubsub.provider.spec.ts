import { PubSubProvider } from './pubsub.provider';

const mockPublishMessage = jest.fn().mockResolvedValue('test-message-id');
const mockTopic = jest.fn().mockReturnValue({ publishMessage: mockPublishMessage });

jest.mock('@google-cloud/pubsub', () => ({
  PubSub: jest.fn().mockImplementation(() => ({
    topic: mockTopic,
  })),
}));

describe('PubSubProvider', () => {
  let provider: PubSubProvider;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, SERVICE_ACCOUNT: '{}' };
    provider = new PubSubProvider();
    jest.clearAllMocks();
    mockPublishMessage.mockResolvedValue('test-message-id');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sendMessage()', () => {
    it('should return mock message in non-production environment', async () => {
      process.env.NODE_ENV = 'development';
      const result = await provider.sendMessage({ test: true }, 'test-topic');

      expect(result.status).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.message).toContain('published');
    });

    it('should publish message in production environment', async () => {
      process.env.NODE_ENV = 'production';
      const result = await provider.sendMessage({ test: true }, 'test-topic', { platform: 'twilio' });

      expect(result.status).toBe(true);
      expect(result.messageId).toBe('test-message-id');
    });

    it('should include Content-Type in attributes', async () => {
      process.env.NODE_ENV = 'production';

      await provider.sendMessage({ test: true }, 'test-topic', { platform: 'email' });

      expect(mockPublishMessage).toHaveBeenCalledWith({
        json: { test: true },
        attributes: { platform: 'email', 'Content-Type': 'application/json' },
      });
    });

    it('should throw error when publish fails in production', async () => {
      process.env.NODE_ENV = 'production';
      mockPublishMessage.mockRejectedValueOnce(new Error('Pub/Sub error'));

      await expect(provider.sendMessage({ test: true }, 'fail-topic')).rejects.toThrow('Error to send message to fail-topic');
    });
  });
});
