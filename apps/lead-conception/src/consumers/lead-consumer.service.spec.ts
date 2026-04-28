import { LeadConsumerService } from './lead-consumer.service';

jest.mock('@bms/messaging', () => ({
  AmqpConsumer: jest.fn().mockImplementation(() => ({
    consume: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
  EXCHANGES: { leads: 'bms.leads' },
}));

describe('LeadConsumerService', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockAppService: any;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.AMQP_URL = 'amqp://guest:guest@localhost:5672';
    mockAppService = {
      createOrUpdate: jest.fn().mockResolvedValue({ status: 200, message: 'ok' }),
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('throws when AMQP_URL is not set', () => {
      delete process.env.AMQP_URL;
      expect(() => new LeadConsumerService(mockAppService)).toThrow('AMQP_URL environment variable is required');
    });

    it('creates instance when AMQP_URL is set', () => {
      expect(() => new LeadConsumerService(mockAppService)).not.toThrow();
    });
  });

  describe('start', () => {
    it('binds queue lead-conception.lead.received on bms.leads exchange', async () => {
      const service = new LeadConsumerService(mockAppService);
      const { AmqpConsumer } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpConsumer.mock.results[0].value;

      await service.start();

      expect(mockInstance.consume).toHaveBeenCalledWith(
        expect.objectContaining({
          exchange: 'bms.leads',
          routingKey: 'lead.received',
          queue: 'lead-conception.lead.received',
          maxRetries: 3,
        }),
        expect.any(Function),
      );
    });

    it('routes to createOrUpdate(payload, false) when ctx.headers.type !== "update"', async () => {
      const service = new LeadConsumerService(mockAppService);
      const { AmqpConsumer } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpConsumer.mock.results[0].value;

      await service.start();
      const handler = mockInstance.consume.mock.calls[0][1];
      const payload = { apiKey: 'k', contact: { email: 'a@b.com' } };

      const result = await handler(payload, { headers: { type: 'lead' } });

      expect(mockAppService.createOrUpdate).toHaveBeenCalledWith(payload, false);
      expect(result).toBe('ack');
    });

    it('routes to createOrUpdate(payload, true) when ctx.headers.type === "update"', async () => {
      const service = new LeadConsumerService(mockAppService);
      const { AmqpConsumer } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpConsumer.mock.results[0].value;

      await service.start();
      const handler = mockInstance.consume.mock.calls[0][1];
      const payload = { apiKey: 'k', contact: { email: 'a@b.com' } };

      await handler(payload, { headers: { type: 'update' } });

      expect(mockAppService.createOrUpdate).toHaveBeenCalledWith(payload, true);
    });

    it('returns nack when service result has non-200 status', async () => {
      mockAppService.createOrUpdate.mockResolvedValue({ status: 500, message: 'fail' });
      const service = new LeadConsumerService(mockAppService);
      const { AmqpConsumer } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpConsumer.mock.results[0].value;

      await service.start();
      const handler = mockInstance.consume.mock.calls[0][1];

      const result = await handler({}, { headers: {} });

      expect(result).toBe('nack');
    });

    it('returns ack when service result has no status field', async () => {
      mockAppService.createOrUpdate.mockResolvedValue(undefined);
      const service = new LeadConsumerService(mockAppService);
      const { AmqpConsumer } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpConsumer.mock.results[0].value;

      await service.start();
      const handler = mockInstance.consume.mock.calls[0][1];

      const result = await handler({}, { headers: {} });

      expect(result).toBe('ack');
    });

    it('handles missing headers safely (defaults to non-update)', async () => {
      const service = new LeadConsumerService(mockAppService);
      const { AmqpConsumer } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpConsumer.mock.results[0].value;

      await service.start();
      const handler = mockInstance.consume.mock.calls[0][1];

      await handler({ x: 1 }, {});

      expect(mockAppService.createOrUpdate).toHaveBeenCalledWith({ x: 1 }, false);
    });
  });

  describe('stop', () => {
    it('delegates to consumer.shutdown()', async () => {
      const service = new LeadConsumerService(mockAppService);
      const { AmqpConsumer } = jest.requireMock('@bms/messaging');
      const mockInstance = AmqpConsumer.mock.results[0].value;

      await service.stop();

      expect(mockInstance.shutdown).toHaveBeenCalled();
    });
  });
});
