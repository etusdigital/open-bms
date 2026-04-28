import { TagPublisherService } from './tag-publisher.service';

jest.mock('@bms/messaging', () => ({
  AmqpPublisher: jest.fn().mockImplementation(() => ({
    publish: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  EXCHANGES: { tags: 'bms.tags' },
}));

describe('TagPublisherService', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.AMQP_URL = 'amqp://guest:guest@localhost:5672';
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('throws when AMQP_URL is not set', () => {
      delete process.env.AMQP_URL;
      expect(() => new TagPublisherService()).toThrow('AMQP_URL environment variable is required');
    });

    it('creates instance when AMQP_URL is set', () => {
      expect(() => new TagPublisherService()).not.toThrow();
    });
  });

  describe('onModuleInit', () => {
    it('calls warmup on init', async () => {
      const service = new TagPublisherService();
      const warmupSpy = jest.spyOn(service, 'warmup').mockResolvedValueOnce(undefined);
      await service.onModuleInit();
      expect(warmupSpy).toHaveBeenCalled();
    });

    it('closes publisher and rethrows when warmup fails', async () => {
      const service = new TagPublisherService();
      jest.spyOn(service, 'warmup').mockRejectedValueOnce(new Error('broker unreachable'));
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[AmqpPublisher.mock.results.length - 1].value;
      await expect(service.onModuleInit()).rejects.toThrow('broker unreachable');
      expect(mockInstance.close).toHaveBeenCalled();
    });
  });

  describe('warmup', () => {
    it('publishes to warmup routing key', async () => {
      const service = new TagPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.warmup();

      expect(mockInstance.publish).toHaveBeenCalledWith({
        exchange: 'bms.tags',
        routingKey: 'tag.warmup.ignore',
        payload: { warmup: true },
      });
    });
  });

  describe('publish', () => {
    it('publishes to bms.tags exchange with routing key tag.process', async () => {
      const service = new TagPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.publish({ tagName: 'newsletter' }, { type: 'add' });

      expect(mockInstance.publish).toHaveBeenCalledWith({
        exchange: 'bms.tags',
        routingKey: 'tag.process',
        payload: { tagName: 'newsletter' },
        headers: { type: 'add' },
      });
    });

    it('drops non-string/number attributes from headers', async () => {
      const service = new TagPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.publish({ tagName: 'x' }, { type: 'add', meta: { nested: true } as any });

      const call = mockInstance.publish.mock.calls[0][0];
      expect(call.headers).not.toHaveProperty('meta');
      expect(call.headers).toHaveProperty('type', 'add');
    });

    it('publishes with empty headers when no attributes given', async () => {
      const service = new TagPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.publish({ tagName: 'x' });

      expect(mockInstance.publish).toHaveBeenCalledWith(expect.objectContaining({ headers: {} }));
    });
  });

  describe('close', () => {
    it('delegates to publisher.close()', async () => {
      const service = new TagPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.close();

      expect(mockInstance.close).toHaveBeenCalled();
    });
  });
});
