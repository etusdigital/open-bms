const consumeMock = jest.fn();
const shutdownMock = jest.fn();
const bridgeHandler = jest.fn();
const ctorMock = jest.fn();

jest.mock('@bms/messaging', () => ({
  AmqpConsumer: jest.fn().mockImplementation((opts, timeout) => {
    ctorMock(opts, timeout);
    return { consume: consumeMock, shutdown: shutdownMock };
  }),
  createHttpBridgeHandler: jest.fn().mockImplementation(() => bridgeHandler),
  EXCHANGES: { push: 'bms.push' },
}));

import { SendPushConsumerService } from './send-push-consumer.service';

describe('SendPushConsumerService', () => {
  beforeEach(() => {
    consumeMock.mockReset().mockResolvedValue(undefined);
    shutdownMock.mockReset().mockResolvedValue(undefined);
    ctorMock.mockReset();
    process.env.AMQP_URL = 'amqp://test';
    process.env.INTERNAL_AUTH_TOKEN = 'unit-token-must-be-long-enough-12345';
    process.env.BRIDGE_ENDPOINT = 'http://localhost:9999';
  });

  it.each([['AMQP_URL'], ['INTERNAL_AUTH_TOKEN'], ['BRIDGE_ENDPOINT']])('throws when %s is missing', (key) => {
    delete process.env[key];
    expect(() => new SendPushConsumerService()).toThrow(new RegExp(key));
  });

  it('binds the push.send queue to bms.push on start', async () => {
    const svc = new SendPushConsumerService();
    await svc.start();

    expect(consumeMock).toHaveBeenCalledTimes(1);
    const [bind] = consumeMock.mock.calls[0];
    expect(bind).toMatchObject({
      exchange: 'bms.push',
      routingKey: 'push.send',
      queue: 'send-push.push.send',
    });
    expect(bind.maxRetries).toBeGreaterThan(0);
  });

  it('stop() shuts down all consumers and swallows individual errors', async () => {
    shutdownMock.mockRejectedValueOnce(new Error('boom'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const svc = new SendPushConsumerService();
    await expect(svc.stop()).resolves.toBeUndefined();
    expect(shutdownMock).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
