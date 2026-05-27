const consumeMock = jest.fn();
const shutdownMock = jest.fn();

jest.mock('@bms/messaging', () => ({
  AmqpConsumer: jest.fn().mockImplementation(() => ({
    consume: consumeMock,
    shutdown: shutdownMock,
  })),
  createHttpBridgeHandler: jest.fn().mockReturnValue(jest.fn()),
  EXCHANGES: { sms: 'bms.sms' },
}));

import { TwilioMessagingConsumerService } from './twilio-messaging-consumer.service';

describe('TwilioMessagingConsumerService', () => {
  beforeEach(() => {
    consumeMock.mockReset().mockResolvedValue(undefined);
    shutdownMock.mockReset().mockResolvedValue(undefined);
    process.env.AMQP_URL = 'amqp://test';
    process.env.INTERNAL_AUTH_TOKEN = 'unit-token-must-be-long-enough-12345';
    process.env.BRIDGE_ENDPOINT = 'http://localhost:9999';
  });

  it.each([['AMQP_URL'], ['INTERNAL_AUTH_TOKEN'], ['BRIDGE_ENDPOINT']])('throws when %s is missing', (key) => {
    delete process.env[key];
    expect(() => new TwilioMessagingConsumerService()).toThrow(new RegExp(key));
  });

  it('binds sms.send queue to bms.sms on start', async () => {
    const svc = new TwilioMessagingConsumerService();
    await svc.start();
    expect(consumeMock).toHaveBeenCalledTimes(1);
    const [bind] = consumeMock.mock.calls[0];
    expect(bind).toMatchObject({
      exchange: 'bms.sms',
      routingKey: 'sms.send',
      queue: 'twilio-messaging.sms.send',
    });
  });

  it('stop() does not reject when shutdown errors', async () => {
    shutdownMock.mockRejectedValueOnce(new Error('boom'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const svc = new TwilioMessagingConsumerService();
    await expect(svc.stop()).resolves.toBeUndefined();
    errSpy.mockRestore();
  });
});
