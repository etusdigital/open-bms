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

describe('EventPublisherService', () => {
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

  it('asserts all published exchanges on bootstrap', async () => {
    const svc = new EventPublisherService();
    await svc.onModuleInit();
    expect(ensureReadyMock).toHaveBeenCalledTimes(6);
    expect(ensureReadyMock).toHaveBeenCalledWith('bms.email');
    expect(ensureReadyMock).toHaveBeenCalledWith('bms.push');
    expect(ensureReadyMock).toHaveBeenCalledWith('bms.sms');
    expect(ensureReadyMock).toHaveBeenCalledWith('bms.whatsapp');
    expect(ensureReadyMock).toHaveBeenCalledWith('bms.tags');
    // whatsapp-webhooks publishes analytics events to bms.events
    expect(ensureReadyMock).toHaveBeenCalledWith('bms.events');
  });

  it('coerces boolean header values to "true"/"false" strings', async () => {
    const svc = new EventPublisherService();
    await svc.publish('bms.email' as any, 'email.send', { foo: 'bar' }, { isTransactional: true, retried: false });
    expect(publishMock).toHaveBeenCalledWith({
      exchange: 'bms.email',
      routingKey: 'email.send',
      payload: { foo: 'bar' },
      headers: { isTransactional: 'true', retried: 'false' },
    });
  });

  it('passes through string and number header values', async () => {
    const svc = new EventPublisherService();
    await svc.publish('bms.push' as any, 'push.send', {}, { type: 'single', priority: 9 });
    const call = publishMock.mock.calls[0][0];
    expect(call.headers).toEqual({ type: 'single', priority: 9 });
  });

  it('throws TypeError on unsupported header value (object)', async () => {
    const svc = new EventPublisherService();
    await expect(svc.publish('bms.email' as any, 'email.send', {}, { weird: { nested: 1 } as any })).rejects.toThrow(TypeError);
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
