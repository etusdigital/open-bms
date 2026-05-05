import { CampaignEventsConsumerService } from './campaign-events-consumer.service';

const consumeMock = jest.fn().mockResolvedValue(undefined);
const shutdownMock = jest.fn().mockResolvedValue(undefined);
const bridgeHandlerMock = jest.fn();

jest.mock('@bms/messaging', () => {
  const actual = jest.requireActual('@bms/messaging');
  return {
    ...actual,
    AmqpConsumer: jest.fn().mockImplementation(() => ({
      consume: consumeMock,
      shutdown: shutdownMock,
    })),
    createHttpBridgeHandler: jest.fn().mockImplementation(() => bridgeHandlerMock),
  };
});

describe('CampaignEventsConsumerService', () => {
  const baseEnv = {
    AMQP_URL: 'amqp://test:test@localhost:5672',
    INTERNAL_AUTH_TOKEN: 'dev-token',
    BRIDGE_ENDPOINT: 'http://localhost:3004',
  };

  beforeEach(() => {
    consumeMock.mockClear();
    shutdownMock.mockClear();
    Object.assign(process.env, baseEnv);
  });

  it('throws when AMQP_URL is missing', () => {
    delete process.env.AMQP_URL;
    expect(() => new CampaignEventsConsumerService()).toThrow(/AMQP_URL/);
  });

  it('throws when INTERNAL_AUTH_TOKEN is missing', () => {
    delete process.env.INTERNAL_AUTH_TOKEN;
    expect(() => new CampaignEventsConsumerService()).toThrow(/INTERNAL_AUTH_TOKEN/);
  });

  it('start() throws when BRIDGE_ENDPOINT is missing and no fallback is passed', async () => {
    delete process.env.BRIDGE_ENDPOINT;
    const svc = new CampaignEventsConsumerService();
    await expect(svc.start()).rejects.toThrow(/BRIDGE_ENDPOINT/);
  });

  it('start() accepts an explicit bridgeEndpoint argument when env is unset', async () => {
    delete process.env.BRIDGE_ENDPOINT;
    const svc = new CampaignEventsConsumerService();
    await svc.start('http://localhost:3004');
    expect(consumeMock).toHaveBeenCalledTimes(1);
  });

  it('binds campaigns/campaign.tracked to the campaign-events-tracker queue on start', async () => {
    const svc = new CampaignEventsConsumerService();
    await svc.start();
    expect(consumeMock).toHaveBeenCalledTimes(1);
    expect(consumeMock).toHaveBeenCalledWith(
      {
        exchange: 'bms.campaigns',
        routingKey: 'campaign.tracked',
        queue: 'campaign-events-tracker.campaign.tracked',
        maxRetries: 3,
      },
      bridgeHandlerMock,
    );
  });

  it('shuts down all consumers on stop', async () => {
    const svc = new CampaignEventsConsumerService();
    await svc.stop();
    expect(shutdownMock).toHaveBeenCalledTimes(1);
  });
});
