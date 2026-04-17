import { Test, TestingModule } from '@nestjs/testing';
import { PubSubService } from './pubsub.service';
import { PubSub } from '@google-cloud/pubsub';

jest.mock('@google-cloud/pubsub');

describe('PubSubService', () => {
  let service: PubSubService;
  let originalEnv: NodeJS.ProcessEnv;
  let mockPublishMessage: jest.Mock;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.TOPIC_NAME_EVENT_PROCESS = 'test-topic';
    process.env.SERVICE_ACCOUNT = '{}';

    mockPublishMessage = jest.fn().mockResolvedValue('message-id');
    (PubSub as unknown as jest.Mock).mockImplementation(() => ({
      topic: () => ({
        publishMessage: mockPublishMessage,
      }),
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if TOPIC_NAME_EVENT_PROCESS is not set', () => {
      delete process.env.TOPIC_NAME_EVENT_PROCESS;
      expect(() => new PubSubService()).toThrow('TOPIC_NAME_EVENT_PROCESS environment variable is required');
    });

    it('should create PubSub client with correct options', () => {
      service = new PubSubService();
      expect(PubSub).toHaveBeenCalledWith({ credentials: {} });
    });

    it('should parse service account credentials correctly', () => {
      const mockCredentials = { project_id: 'test-project' };
      process.env.SERVICE_ACCOUNT = JSON.stringify(mockCredentials);

      service = new PubSubService();
      expect(PubSub).toHaveBeenCalledWith({ credentials: mockCredentials });
    });
  });

  describe('sendAsyncMessage', () => {
    const mockMessage = { data: 'test' };
    const mockAttributes = { type: 'test' };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [PubSubService],
      }).compile();

      service = module.get<PubSubService>(PubSubService);
    });

    it('should return mock message ID in non-production', async () => {
      process.env.NODE_ENV = 'development';
      const result = await service.sendAsyncMessage(mockMessage, mockAttributes);
      expect(result).toMatch(/^[a-f0-9]{40}$/);
    });

    it('should publish message to topic in production', async () => {
      process.env.NODE_ENV = 'production';
      const result = await service.sendAsyncMessage(mockMessage, mockAttributes);

      expect(mockPublishMessage).toHaveBeenCalledWith({
        json: mockMessage,
        attributes: {
          ...mockAttributes,
          'Content-Type': 'application/json',
        },
      });
      expect(result).toBe('message-id');
    });

    it('should add Content-Type to attributes', async () => {
      process.env.NODE_ENV = 'production';
      await service.sendAsyncMessage(mockMessage, mockAttributes);

      expect(mockPublishMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should log message in non-production environment', async () => {
      process.env.NODE_ENV = 'development';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.sendAsyncMessage(mockMessage, mockAttributes);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test-topic'), expect.stringContaining('test'));
      consoleSpy.mockRestore();
    });
  });
});
