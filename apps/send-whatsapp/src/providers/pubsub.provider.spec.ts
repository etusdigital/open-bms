import { PubSubProvider } from './pubsub.provider';

describe('PubSubProvider', () => {
  let provider: PubSubProvider;

  beforeEach(() => {
    process.env.SERVICE_ACCOUNT = '{}';
    provider = new PubSubProvider();
  });

  describe('sendMessage', () => {
    it('should return a mock message in non-production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const result = await provider.sendMessage({ test: true }, 'test-topic');

      expect(result).toHaveProperty('messageId');
      expect(result).toHaveProperty('message');
      expect(result.status).toBe(true);
      expect(result.message).toContain('published');

      process.env.NODE_ENV = originalEnv;
    });

    it('should return different messageIds for different calls', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const result1 = await provider.sendMessage({ test: 1 }, 'topic');
      const result2 = await provider.sendMessage({ test: 2 }, 'topic');

      expect(result1.messageId).not.toBe(result2.messageId);

      process.env.NODE_ENV = originalEnv;
    });
  });
});
