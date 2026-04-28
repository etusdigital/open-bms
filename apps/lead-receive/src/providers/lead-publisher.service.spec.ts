import { LeadPublisherService } from './lead-publisher.service';

jest.mock('@bms/messaging', () => ({
  AmqpPublisher: jest.fn().mockImplementation(() => ({
    publish: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  EXCHANGES: { leads: 'bms.leads' },
}));

describe('LeadPublisherService', () => {
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
      expect(() => new LeadPublisherService()).toThrow('AMQP_URL environment variable is required');
    });

    it('creates instance when AMQP_URL is set', () => {
      expect(() => new LeadPublisherService()).not.toThrow();
    });
  });

  describe('onModuleInit', () => {
    it('calls warmup on init', async () => {
      const service = new LeadPublisherService();
      const warmupSpy = jest.spyOn(service, 'warmup').mockResolvedValueOnce(undefined);
      await service.onModuleInit();
      expect(warmupSpy).toHaveBeenCalled();
    });

    it('closes publisher and rethrows when warmup fails', async () => {
      const service = new LeadPublisherService();
      jest.spyOn(service, 'warmup').mockRejectedValueOnce(new Error('broker unreachable'));
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[AmqpPublisher.mock.results.length - 1].value;
      await expect(service.onModuleInit()).rejects.toThrow('broker unreachable');
      expect(mockInstance.close).toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('publishes to bms.leads exchange with routing key lead.received', async () => {
      const service = new LeadPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.publish({ email: 'a@b.com' }, { type: 'lead' });

      expect(mockInstance.publish).toHaveBeenCalledWith({
        exchange: 'bms.leads',
        routingKey: 'lead.received',
        payload: { email: 'a@b.com' },
        headers: { type: 'lead' },
      });
    });

    it('passes type=update header for update publishes', async () => {
      const service = new LeadPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.publish({ email: 'b@c.com' }, { type: 'update' });

      expect(mockInstance.publish).toHaveBeenCalledWith(expect.objectContaining({ headers: { type: 'update' } }));
    });

    it('drops non-string/number attributes from headers', async () => {
      const service = new LeadPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.publish({ email: 'c@d.com' }, { type: 'lead', meta: { nested: true } as any });

      const call = mockInstance.publish.mock.calls[0][0];
      expect(call.headers).not.toHaveProperty('meta');
      expect(call.headers).toHaveProperty('type', 'lead');
    });

    it('publishes with empty headers when no attributes given', async () => {
      const service = new LeadPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.publish({ email: 'd@e.com' });

      expect(mockInstance.publish).toHaveBeenCalledWith(expect.objectContaining({ headers: {} }));
    });
  });

  describe('warmup', () => {
    it('publishes to warmup routing key (no consumer binding — broker drops)', async () => {
      const service = new LeadPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.warmup();

      expect(mockInstance.publish).toHaveBeenCalledWith({
        exchange: 'bms.leads',
        routingKey: 'lead.received.warmup.ignore',
        payload: { warmup: true },
      });
    });
  });

  describe('close', () => {
    it('delegates to publisher.close()', async () => {
      const service = new LeadPublisherService();
      const { AmqpPublisher } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpPublisher.mock.results[0].value;

      await service.close();

      expect(mockInstance.close).toHaveBeenCalled();
    });
  });
});
