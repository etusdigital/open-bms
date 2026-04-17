import { PubSubProvider } from './pubsub.provider';

jest.mock('@google-cloud/pubsub', () => {
  const mockPublishMessage = jest.fn().mockResolvedValue('msg-id-123');
  const mockTopic = jest.fn().mockReturnValue({ publishMessage: mockPublishMessage });
  return {
    PubSub: jest.fn().mockImplementation(() => ({ topic: mockTopic })),
  };
});

describe('PubSubProvider', () => {
  let provider: PubSubProvider;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.SERVICE_ACCOUNT = '{}';
    process.env.TOPIC_NAME_MESSAGE_TRIGGER = 'topic-trigger';
    process.env.TOPIC_NAME_CLICK_HOUSE = 'topic-clickhouse';
    process.env.TOPIC_NAME_SEGMENT_TO_CLICK_HOUSE = 'topic-segment';
    provider = new PubSubProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sendMessage', () => {
    it('should return random hex in non-production', async () => {
      process.env.NODE_ENV = 'test';
      const result = await provider.sendMessage({ test: true });
      expect(typeof result).toBe('string');
    });

    it('should publish message in production', async () => {
      process.env.NODE_ENV = 'production';
      const result = await provider.sendMessage({ test: true });
      expect(result).toEqual(expect.objectContaining({ messageId: 'msg-id-123', status: true }));
    });

    it('should throw on publish error in production', async () => {
      process.env.NODE_ENV = 'production';
      provider.clientTopic = {
        publishMessage: jest.fn().mockRejectedValue(new Error('pub error')),
      } as any;
      await expect(provider.sendMessage({ test: true })).rejects.toThrow('Error to send message');
    });
  });

  describe('sendMessageClickHouse', () => {
    it('should return random hex in non-production', async () => {
      process.env.NODE_ENV = 'test';
      const result = await provider.sendMessageClickHouse({
        accountId: 1,
        event: 'test',
        timestamp: Date.now(),
      });
      expect(typeof result).toBe('string');
    });

    it('should publish clickhouse message in production', async () => {
      process.env.NODE_ENV = 'production';
      const result = await provider.sendMessageClickHouse({
        accountId: 1,
        event: 'test',
        timestamp: Date.now(),
      });
      expect(result).toEqual(expect.objectContaining({ status: true }));
    });

    it('should throw on publish error in production', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      process.env.NODE_ENV = 'production';
      provider.clickHouseTopic = {
        publishMessage: jest.fn().mockRejectedValue(new Error('pub error')),
      } as any;
      await expect(
        provider.sendMessageClickHouse({ accountId: 1, event: 'test', timestamp: Date.now() }),
      ).rejects.toThrow('Error to send message');
    });
  });

  describe('sendMessageSegment', () => {
    it('should return random hex in non-production', async () => {
      process.env.NODE_ENV = 'test';
      const result = await provider.sendMessageSegment({ test: true });
      expect(typeof result).toBe('string');
    });

    it('should publish segment message in production', async () => {
      process.env.NODE_ENV = 'production';
      const result = await provider.sendMessageSegment({ test: true });
      expect(result).toEqual(expect.objectContaining({ status: true }));
    });

    it('should throw on publish error in production', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      process.env.NODE_ENV = 'production';
      provider.segmentTopic = {
        publishMessage: jest.fn().mockRejectedValue(new Error('pub error')),
      } as any;
      await expect(provider.sendMessageSegment({ test: true })).rejects.toThrow('Error to send message');
    });
  });
});
