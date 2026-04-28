import { TriggerPublisherService } from './trigger-publisher.service';

jest.mock('@bms/messaging', () => ({
  AmqpPublisher: jest.fn().mockImplementation(() => ({
    publish: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  EXCHANGES: { triggers: 'bms.triggers' },
}));

describe('TriggerPublisherService', () => {
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
      expect(() => new TriggerPublisherService()).toThrow('AMQP_URL environment variable is required');
    });

    it('creates instance when AMQP_URL is set', () => {
      expect(() => new TriggerPublisherService()).not.toThrow();
    });
  });

  describe('onModuleInit', () => {
    it('calls warmup on init', async () => {
      const service = new TriggerPublisherService();
      const warmupSpy = jest.spyOn(service, 'warmup').mockResolvedValueOnce(undefined);
      await service.onModuleInit();
      expect(warmupSpy).toHaveBeenCalled();
    });

    it('closes publisher and rethrows when warmup fails', async () => {
      const service = new TriggerPublisherService();
      jest.spyOn(service, 'warmup').mockRejectedValueOnce(new Error('broker unreachable'));
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[AmqpPublisher.mock.results.length - 1].value;
      await expect(service.onModuleInit()).rejects.toThrow('broker unreachable');
      expect(mockInstance.close).toHaveBeenCalled();
    });
  });

  describe('warmup', () => {
    it('publishes to warmup routing key', async () => {
      const service = new TriggerPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.warmup();

      expect(mockInstance.publish).toHaveBeenCalledWith({
        exchange: 'bms.triggers',
        routingKey: 'trigger.warmup.ignore',
        payload: { warmup: true },
      });
    });
  });

  describe('publish', () => {
    it('publishes to bms.triggers exchange with routing key trigger.process', async () => {
      const service = new TriggerPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.publish({ event: 'quiz_submitted', accountId: 1 });

      expect(mockInstance.publish).toHaveBeenCalledWith({
        exchange: 'bms.triggers',
        routingKey: 'trigger.process',
        payload: { event: 'quiz_submitted', accountId: 1 },
        headers: {},
      });
    });

    it('drops non-string/number attributes from headers', async () => {
      const service = new TriggerPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.publish({ event: 'x' }, { kind: 'emc', payload: {} as any });

      const call = mockInstance.publish.mock.calls[0][0];
      expect(call.headers).toEqual({ kind: 'emc' });
    });
  });

  describe('close', () => {
    it('delegates to publisher.close()', async () => {
      const service = new TriggerPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.close();

      expect(mockInstance.close).toHaveBeenCalled();
    });
  });
});
