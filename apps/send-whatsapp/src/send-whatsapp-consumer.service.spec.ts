const consumeMock = jest.fn();
const shutdownMock = jest.fn();

jest.mock('@bms/messaging', () => ({
  AmqpConsumer: jest.fn().mockImplementation(() => ({
    consume: consumeMock,
    shutdown: shutdownMock,
  })),
  createHttpBridgeHandler: jest.fn().mockReturnValue(jest.fn()),
  EXCHANGES: { whatsapp: 'bms.whatsapp' },
}));

import { SendWhatsappConsumerService } from './send-whatsapp-consumer.service';

describe('SendWhatsappConsumerService', () => {
  beforeEach(() => {
    consumeMock.mockReset().mockResolvedValue(undefined);
    shutdownMock.mockReset().mockResolvedValue(undefined);
    process.env.AMQP_URL = 'amqp://test';
    process.env.INTERNAL_AUTH_TOKEN = 'unit-token-must-be-long-enough-12345';
    process.env.BRIDGE_ENDPOINT = 'http://localhost:9999';
  });

  it.each([['AMQP_URL'], ['INTERNAL_AUTH_TOKEN'], ['BRIDGE_ENDPOINT']])('throws when %s is missing', (key) => {
    delete process.env[key];
    expect(() => new SendWhatsappConsumerService()).toThrow(new RegExp(key));
  });

  it('binds whatsapp.send queue to bms.whatsapp on start', async () => {
    const svc = new SendWhatsappConsumerService();
    await svc.start();
    expect(consumeMock).toHaveBeenCalledTimes(1);
    const [bind] = consumeMock.mock.calls[0];
    expect(bind).toMatchObject({
      exchange: 'bms.whatsapp',
      routingKey: 'whatsapp.send',
      queue: 'send-whatsapp.whatsapp.send',
    });
  });

  it('stop() does not reject when shutdown errors', async () => {
    shutdownMock.mockRejectedValueOnce(new Error('boom'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const svc = new SendWhatsappConsumerService();
    await expect(svc.stop()).resolves.toBeUndefined();
    errSpy.mockRestore();
  });
});
