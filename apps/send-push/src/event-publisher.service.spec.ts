const publishMock = jest.fn();
const closeMock = jest.fn();
const ctorMock = jest.fn();

jest.mock('@bms/messaging', () => ({
  AmqpPublisher: jest.fn().mockImplementation((opts) => {
    ctorMock(opts);
    return { publish: publishMock, close: closeMock };
  }),
}));

import { EventPublisherService } from './event-publisher.service';

describe('EventPublisherService', () => {
  beforeEach(() => {
    publishMock.mockReset().mockResolvedValue(undefined);
    closeMock.mockReset().mockResolvedValue(undefined);
    ctorMock.mockReset();
    process.env.AMQP_URL = 'amqp://test';
  });

  it('throws when AMQP_URL is not set', () => {
    delete process.env.AMQP_URL;
    expect(() => new EventPublisherService()).toThrow(/AMQP_URL/);
  });

  it('forwards publish payload and coerces header types', async () => {
    const svc = new EventPublisherService();
    await svc.publish(
      'bms.events' as any,
      'event.received.push',
      { foo: 1 },
      {
        str: 'a',
        num: 7,
        bool: true,
        bad: { nested: 1 },
      }
    );

    expect(publishMock).toHaveBeenCalledTimes(1);
    const call = publishMock.mock.calls[0][0];
    expect(call.exchange).toBe('bms.events');
    expect(call.routingKey).toBe('event.received.push');
    expect(call.payload).toEqual({ foo: 1 });
    expect(call.headers).toEqual({ str: 'a', num: 7, bool: 'true' });
    expect(call.headers).not.toHaveProperty('bad');
  });

  it('close() delegates to publisher', async () => {
    const svc = new EventPublisherService();
    await svc.close();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
