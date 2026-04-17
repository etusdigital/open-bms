import { PubSubProvider } from './pubsub.provider';

jest.mock('@google-cloud/pubsub', () => ({
  PubSub: jest.fn().mockImplementation(() => ({
    topic: jest.fn(),
  })),
}));

describe('PubSubProvider', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('should return mock messageId without calling PubSub in non-production', async () => {
    process.env.NODE_ENV = 'development';
    const provider = new PubSubProvider();
    const topicMock = jest.fn();
    (provider as any).client = { topic: topicMock };

    const result = await provider.sendMessage({ ok: true }, 'topic-test');

    expect(result.status).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(topicMock).not.toHaveBeenCalled();
  });

  it('should publish message with attributes in production', async () => {
    process.env.NODE_ENV = 'production';
    const provider = new PubSubProvider();
    const publishMessage = jest.fn().mockResolvedValue('message-123');
    const topicMock = jest.fn().mockReturnValue({ publishMessage });
    (provider as any).client = { topic: topicMock };

    const payload = { campaign_id: 1 };
    const attributes = { platform: 'web-push' };

    const result = await provider.sendMessage(payload, 'topic-live', attributes);

    expect(topicMock).toHaveBeenCalledWith('topic-live');
    expect(publishMessage).toHaveBeenCalledWith({
      json: payload,
      attributes: {
        platform: 'web-push',
        'Content-type': 'application/json',
      },
    });
    expect(result).toEqual({
      messageId: 'message-123',
      message: 'Message message-123 published.',
      status: true,
    });
  });

  it('should throw when publishMessage fails in production', async () => {
    process.env.NODE_ENV = 'production';
    const provider = new PubSubProvider();
    const publishMessage = jest.fn().mockRejectedValue(new Error('publish error'));
    const topicMock = jest.fn().mockReturnValue({ publishMessage });
    (provider as any).client = { topic: topicMock };

    await expect(provider.sendMessage({ ok: true }, 'topic-live')).rejects.toThrow(
      'Error to send message to topic-live.'
    );
  });

  it('should publish message with default empty attributes in production', async () => {
    process.env.NODE_ENV = 'production';
    const provider = new PubSubProvider();
    const publishMessage = jest.fn().mockResolvedValue('message-456');
    const topicMock = jest.fn().mockReturnValue({ publishMessage });
    (provider as any).client = { topic: topicMock };

    const result = await provider.sendMessage({ data: 1 }, 'topic-default');

    expect(publishMessage).toHaveBeenCalledWith({
      json: { data: 1 },
      attributes: { 'Content-type': 'application/json' },
    });
    expect(result.status).toBe(true);
  });
});
