import { PubSubProvider } from './pubsub.provider';

describe('PubSubProvider', () => {
  let provider: PubSubProvider;

  beforeEach(() => {
    process.env.SERVICE_ACCOUNT = '{}';
    provider = new PubSubProvider();
  });

  describe('sendMessage', () => {
    it('should return messageId in non-production env', async () => {
      process.env.NODE_ENV = 'test';
      const result = await provider.sendMessage({ foo: 'bar' }, 'test-topic');
      expect(result).toHaveProperty('messageId');
      expect(result).toHaveProperty('status', true);
      expect(result.message).toContain('published');
    });

    it('should return messageId with attributes', async () => {
      process.env.NODE_ENV = 'test';
      const result = await provider.sendMessage({ foo: 'bar' }, 'test-topic', { key: 'value' });
      expect(result.status).toBe(true);
    });
  });
});
