import { EventPublisherService } from './event-publisher.service';

jest.mock('@bms/messaging', () => ({
  AmqpPublisher: jest.fn().mockImplementation(() => ({
    publish: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  EXCHANGES: { events: 'bms.events' },
}));

describe('EventPublisherService', () => {
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
      expect(() => new EventPublisherService()).toThrow('AMQP_URL environment variable is required');
    });

    it('creates instance when AMQP_URL is set', () => {
      expect(() => new EventPublisherService()).not.toThrow();
    });
  });

  describe('onModuleInit', () => {
    it('calls warmup on init', async () => {
      const service = new EventPublisherService();
      const warmupSpy = jest.spyOn(service, 'warmup').mockResolvedValueOnce(undefined);
      await service.onModuleInit();
      expect(warmupSpy).toHaveBeenCalled();
    });

    it('closes publisher and rethrows when warmup fails', async () => {
      const service = new EventPublisherService();
      jest.spyOn(service, 'warmup').mockRejectedValueOnce(new Error('broker unreachable'));
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[AmqpPublisher.mock.results.length - 1].value;
      await expect(service.onModuleInit()).rejects.toThrow('broker unreachable');
      expect(mockInstance.close).toHaveBeenCalled();
    });
  });

  describe('warmup', () => {
    it('publishes to warmup routing key (no consumer binding — broker drops)', async () => {
      const service = new EventPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.warmup();

      expect(mockInstance.publish).toHaveBeenCalledWith({
        exchange: 'bms.events',
        routingKey: 'event.received.warmup.ignore',
        payload: { warmup: true },
      });
    });
  });

  describe('publish', () => {
    it('publishes to bms.events exchange with routing key event.received.internal', async () => {
      const service = new EventPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.publish({ event: 'lead_submitted' }, { platform: 'internal' });

      expect(mockInstance.publish).toHaveBeenCalledWith({
        exchange: 'bms.events',
        routingKey: 'event.received.internal',
        payload: { event: 'lead_submitted' },
        headers: { platform: 'internal' },
      });
    });

    it('drops non-string/number attributes from headers', async () => {
      const service = new EventPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.publish({ event: 'x' }, { platform: 'internal', meta: { nested: true } as any });

      const call = mockInstance.publish.mock.calls[0][0];
      expect(call.headers).not.toHaveProperty('meta');
      expect(call.headers).toHaveProperty('platform', 'internal');
    });

    it('publishes with empty headers when no attributes given', async () => {
      const service = new EventPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.publish({ event: 'x' });

      expect(mockInstance.publish).toHaveBeenCalledWith(expect.objectContaining({ headers: {} }));
    });

    it('keeps numeric header values', async () => {
      const service = new EventPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.publish({ event: 'x' }, { count: 5 as any });

      const call = mockInstance.publish.mock.calls[0][0];
      expect(call.headers).toEqual({ count: 5 });
    });
  });

  describe('close', () => {
    it('delegates to publisher.close()', async () => {
      const service = new EventPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.close();

      expect(mockInstance.close).toHaveBeenCalled();
    });
  });
});
