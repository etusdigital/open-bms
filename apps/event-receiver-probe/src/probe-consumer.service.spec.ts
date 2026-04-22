import { Test, TestingModule } from '@nestjs/testing';
import { ProbeConsumerService } from './probe-consumer.service';

const consumeMock = jest.fn().mockResolvedValue(undefined);
const shutdownMock = jest.fn().mockResolvedValue(undefined);
const AmqpConsumerMock = jest.fn().mockImplementation(() => ({
  consume: consumeMock,
  shutdown: shutdownMock,
}));
const createHttpBridgeHandlerMock = jest.fn().mockReturnValue('HANDLER_SENTINEL');

jest.mock('@bms/messaging', () => ({
  AmqpConsumer: jest.fn().mockImplementation((...args) => AmqpConsumerMock(...args)),
  createHttpBridgeHandler: (...args: unknown[]) => createHttpBridgeHandlerMock(...args),
  EXCHANGES: { events: 'bms.events' },
}));

describe('ProbeConsumerService', () => {
  let service: ProbeConsumerService;
  const origAmqpUrl = process.env.AMQP_URL;
  const origToken = process.env.INTERNAL_AUTH_TOKEN;
  const origEndpoint = process.env.BRIDGE_ENDPOINT;

  beforeEach(async () => {
    consumeMock.mockClear();
    shutdownMock.mockClear();
    AmqpConsumerMock.mockClear();
    createHttpBridgeHandlerMock.mockClear();

    process.env.AMQP_URL = 'amqp://guest:guest@localhost:5672';
    process.env.INTERNAL_AUTH_TOKEN = 'dev-probe-token';
    process.env.BRIDGE_ENDPOINT = 'http://localhost:3012/internal/event/received';

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProbeConsumerService],
    }).compile();

    service = module.get<ProbeConsumerService>(ProbeConsumerService);
  });

  afterEach(() => {
    process.env.AMQP_URL = origAmqpUrl;
    process.env.INTERNAL_AUTH_TOKEN = origToken;
    process.env.BRIDGE_ENDPOINT = origEndpoint;
  });

  it('passes shutdownTimeoutMs=10000 to AmqpConsumer', () => {
    expect(AmqpConsumerMock).toHaveBeenCalledWith({ url: 'amqp://guest:guest@localhost:5672' }, 10_000);
  });

  it('throws without AMQP_URL', async () => {
    delete process.env.AMQP_URL;
    await expect(Test.createTestingModule({ providers: [ProbeConsumerService] }).compile()).rejects.toThrow(
      'AMQP_URL environment variable is required',
    );
  });

  it('throws without INTERNAL_AUTH_TOKEN', async () => {
    delete process.env.INTERNAL_AUTH_TOKEN;
    await expect(Test.createTestingModule({ providers: [ProbeConsumerService] }).compile()).rejects.toThrow(
      'INTERNAL_AUTH_TOKEN environment variable is required',
    );
  });

  it('throws without BRIDGE_ENDPOINT', async () => {
    delete process.env.BRIDGE_ENDPOINT;
    await expect(Test.createTestingModule({ providers: [ProbeConsumerService] }).compile()).rejects.toThrow(
      'BRIDGE_ENDPOINT environment variable is required',
    );
  });

  it('start() calls consume with correct options and bridge handler', async () => {
    await service.start();
    expect(createHttpBridgeHandlerMock).toHaveBeenCalledWith({
      endpoint: 'http://localhost:3012/internal/event/received',
      token: 'dev-probe-token',
    });
    expect(consumeMock).toHaveBeenCalledWith(
      {
        exchange: 'bms.events',
        routingKey: 'event.received.sendgrid',
        queue: 'event-process-probe.event.received.sendgrid',
        maxRetries: 3,
      },
      'HANDLER_SENTINEL',
    );
  });

  it('stop() delegates to consumer.shutdown()', async () => {
    await service.stop();
    expect(shutdownMock).toHaveBeenCalledTimes(1);
  });
});
