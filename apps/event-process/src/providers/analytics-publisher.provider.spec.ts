import { ANALYTICS_ROUTING_KEY, AnalyticsPublisherProvider } from './analytics-publisher.provider';
import { AmqpPublisher, EXCHANGES } from '@bms/messaging';

jest.mock('@bms/messaging', () => {
  const actual = jest.requireActual('@bms/messaging');
  return {
    ...actual,
    AmqpPublisher: jest.fn(),
  };
});

const MockAmqpPublisher = AmqpPublisher as unknown as jest.Mock;

function makePublisherInstance(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    ensureReady: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AnalyticsPublisherProvider', () => {
  const ORIGINAL_AMQP_URL = process.env.AMQP_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AMQP_URL = 'amqp://test';
  });

  afterAll(() => {
    if (ORIGINAL_AMQP_URL === undefined) delete process.env.AMQP_URL;
    else process.env.AMQP_URL = ORIGINAL_AMQP_URL;
  });

  describe('onModuleInit', () => {
    it('throws when AMQP_URL is missing', async () => {
      delete process.env.AMQP_URL;
      const provider = new AnalyticsPublisherProvider();
      await expect(provider.onModuleInit()).rejects.toThrow('AMQP_URL environment variable is required');
      expect(MockAmqpPublisher).not.toHaveBeenCalled();
    });

    it('constructs AmqpPublisher with the configured URL and warms up', async () => {
      const inst = makePublisherInstance();
      MockAmqpPublisher.mockImplementation(() => inst);

      const provider = new AnalyticsPublisherProvider();
      await provider.onModuleInit();

      expect(MockAmqpPublisher).toHaveBeenCalledWith({ url: 'amqp://test' });
      expect(inst.ensureReady).toHaveBeenCalledWith(EXCHANGES.analytics);
    });

    it('closes the publisher and rethrows when warmup fails', async () => {
      const warmupErr = new Error('rabbit down');
      const inst = makePublisherInstance({
        ensureReady: jest.fn().mockRejectedValue(warmupErr),
      });
      MockAmqpPublisher.mockImplementation(() => inst);

      const provider = new AnalyticsPublisherProvider();
      await expect(provider.onModuleInit()).rejects.toBe(warmupErr);
      expect(inst.close).toHaveBeenCalledTimes(1);
    });

    it('rethrows the warmup error even when close also fails', async () => {
      const warmupErr = new Error('rabbit down');
      const inst = makePublisherInstance({
        ensureReady: jest.fn().mockRejectedValue(warmupErr),
        close: jest.fn().mockRejectedValue(new Error('close blew up')),
      });
      MockAmqpPublisher.mockImplementation(() => inst);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const provider = new AnalyticsPublisherProvider();
      await expect(provider.onModuleInit()).rejects.toBe(warmupErr);
      expect(inst.close).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('publish', () => {
    it('forwards payload to the analytics exchange with the enriched routing key', async () => {
      const inst = makePublisherInstance();
      MockAmqpPublisher.mockImplementation(() => inst);

      const provider = new AnalyticsPublisherProvider();
      await provider.onModuleInit();
      await provider.publish({ event: 'click', account_id: 1 });

      expect(inst.publish).toHaveBeenCalledWith({
        exchange: EXCHANGES.analytics,
        routingKey: ANALYTICS_ROUTING_KEY,
        payload: { event: 'click', account_id: 1 },
      });
    });
  });

  describe('warmup', () => {
    it('uses ensureReady so no payload is published to the exchange', async () => {
      const inst = makePublisherInstance();
      MockAmqpPublisher.mockImplementation(() => inst);

      const provider = new AnalyticsPublisherProvider();
      await provider.onModuleInit();

      expect(inst.ensureReady).toHaveBeenCalledTimes(1);
      expect(inst.publish).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('closes the underlying publisher', async () => {
      const inst = makePublisherInstance();
      MockAmqpPublisher.mockImplementation(() => inst);

      const provider = new AnalyticsPublisherProvider();
      await provider.onModuleInit();
      await provider.onModuleDestroy();

      expect(inst.close).toHaveBeenCalledTimes(1);
    });

    it('no-ops when init never ran', async () => {
      const provider = new AnalyticsPublisherProvider();
      await expect(provider.onModuleDestroy()).resolves.toBeUndefined();
    });

    it('swallows close errors and logs a warning', async () => {
      const inst = makePublisherInstance({
        close: jest.fn().mockRejectedValue(new Error('boom')),
      });
      MockAmqpPublisher.mockImplementation(() => inst);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const provider = new AnalyticsPublisherProvider();
      await provider.onModuleInit();
      await expect(provider.onModuleDestroy()).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
