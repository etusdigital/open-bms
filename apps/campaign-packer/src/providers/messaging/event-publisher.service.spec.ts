import { EventPublisherService } from './event-publisher.service';

const publishMock = jest.fn().mockResolvedValue(undefined);
const ensureReadyMock = jest.fn().mockResolvedValue(undefined);
const closeMock = jest.fn().mockResolvedValue(undefined);

jest.mock('@bms/messaging', () => {
  const actual = jest.requireActual('@bms/messaging');
  return {
    ...actual,
    AmqpPublisher: jest.fn().mockImplementation(() => ({
      publish: publishMock,
      ensureReady: ensureReadyMock,
      close: closeMock,
    })),
  };
});

describe('EventPublisherService (campaign-packer)', () => {
  beforeEach(() => {
    publishMock.mockClear();
    ensureReadyMock.mockClear();
    closeMock.mockClear();
    process.env.AMQP_URL = 'amqp://test:test@localhost:5672';
  });

  it('throws at construction when AMQP_URL is missing', () => {
    delete process.env.AMQP_URL;
    expect(() => new EventPublisherService()).toThrow(/AMQP_URL/);
  });

  it('asserts the campaigns exchange on bootstrap', async () => {
    const svc = new EventPublisherService();
    await svc.onModuleInit();
    expect(ensureReadyMock).toHaveBeenCalledTimes(1);
    expect(ensureReadyMock).toHaveBeenCalledWith('bms.campaigns');
  });

  it('publishes payload to the requested exchange/routingKey', async () => {
    const svc = new EventPublisherService();
    await svc.publish('bms.campaigns' as any, 'campaign.send', { campaignKey: 'k' });
    expect(publishMock).toHaveBeenCalledWith({
      exchange: 'bms.campaigns',
      routingKey: 'campaign.send',
      payload: { campaignKey: 'k' },
      headers: {},
    });
  });

  it('coerces boolean header values to "true"/"false" strings', async () => {
    const svc = new EventPublisherService();
    await svc.publish('bms.campaigns' as any, 'campaign.tracked', { foo: 'bar' }, { isTransactional: true, retried: false });
    expect(publishMock).toHaveBeenCalledWith({
      exchange: 'bms.campaigns',
      routingKey: 'campaign.tracked',
      payload: { foo: 'bar' },
      headers: { isTransactional: 'true', retried: 'false' },
    });
  });

  it('throws TypeError on unsupported header value (object)', async () => {
    const svc = new EventPublisherService();
    await expect(svc.publish('bms.campaigns' as any, 'campaign.send', {}, { weird: { nested: 1 } as any })).rejects.toThrow(TypeError);
  });

  it('swallows close errors and logs (does not crash shutdown)', async () => {
    closeMock.mockRejectedValueOnce(new Error('connection already gone'));
    const svc = new EventPublisherService();
    const errSpy = jest.spyOn(console, 'error').mockImplementation();
    await expect(svc.onModuleDestroy()).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
