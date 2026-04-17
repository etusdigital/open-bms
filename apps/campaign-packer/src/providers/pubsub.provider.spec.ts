import { PubSubProvider } from './pubsub.provider';

jest.mock('@google-cloud/pubsub', () => {
  const mockPublishMessage = jest.fn().mockResolvedValue('mock-msg-id');
  const mockTopic = jest.fn().mockReturnValue({ publishMessage: mockPublishMessage });
  return {
    PubSub: jest.fn().mockImplementation(() => ({
      topic: mockTopic,
    })),
    Topic: jest.fn().mockImplementation(() => ({
      publishMessage: mockPublishMessage,
    })),
  };
});

describe('PubSubProvider', () => {
  let provider: PubSubProvider;

  beforeEach(() => {
    process.env.SERVICE_ACCOUNT = '{}';
    process.env.TOPIC_MSGOPS_CAMPAIGN_SCHEDULE_PAGE = 'test-schedule-page';
    provider = new PubSubProvider();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('publishMessage', () => {
    it('should return hex string in non-production', async () => {
      process.env.NODE_ENV = 'test';
      const result = await provider.publishMessage('topic', { data: 'test' });
      expect(result).toMatch(/^[a-f0-9]{40}$/);
    });

    it('should call client.topic().publishMessage() in production', async () => {
      process.env.NODE_ENV = 'production';
      const result = await provider.publishMessage('topic', { data: 'test' });
      expect(result).toBe('mock-msg-id');
      process.env.NODE_ENV = 'test';
    });
  });

  describe('publishMessagePagesOnTopic', () => {
    it('should return hex string in non-production', async () => {
      process.env.NODE_ENV = 'test';
      const result = await provider.publishMessagePagesOnTopic({ data: 'test' });
      expect(result).toMatch(/^[a-f0-9]{40}$/);
    });

    it('should call pageTopic.publishMessage() in production', async () => {
      process.env.NODE_ENV = 'production';
      const result = await provider.publishMessagePagesOnTopic({ data: 'test' });
      expect(result).toBe('mock-msg-id');
      process.env.NODE_ENV = 'test';
    });
  });
});
