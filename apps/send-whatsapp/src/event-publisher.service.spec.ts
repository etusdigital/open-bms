const publishMock = jest.fn();
const closeMock = jest.fn();

jest.mock('@bms/messaging', () => ({
  AmqpPublisher: jest.fn().mockImplementation(() => ({
    publish: publishMock,
    close: closeMock,
  })),
}));

import { EventPublisherService } from './event-publisher.service';

describe('EventPublisherService (send-whatsapp)', () => {
  beforeEach(() => {
    publishMock.mockReset().mockResolvedValue(undefined);
    closeMock.mockReset().mockResolvedValue(undefined);
    process.env.AMQP_URL = 'amqp://test';
  });

  it('throws when AMQP_URL is not set', () => {
    delete process.env.AMQP_URL;
    expect(() => new EventPublisherService()).toThrow(/AMQP_URL/);
  });

  it('forwards publish payload with coerced headers', async () => {
    const svc = new EventPublisherService();
    await svc.publish('bms.triggers' as any, 'trigger.process', { data: 1 }, { x: 'y', n: 2, b: false });
    const call = publishMock.mock.calls[0][0];
    expect(call.exchange).toBe('bms.triggers');
    expect(call.routingKey).toBe('trigger.process');
    expect(call.headers).toEqual({ x: 'y', n: 2, b: 'false' });
  });

  it('close() delegates to publisher', async () => {
    const svc = new EventPublisherService();
    await svc.close();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
