const publishMock = jest.fn();
const closeMock = jest.fn();

jest.mock('@bms/messaging', () => ({
  AmqpPublisher: jest.fn().mockImplementation(() => ({
    publish: publishMock,
    close: closeMock,
  })),
}));

import { EventPublisherService } from './event-publisher.service';

describe('EventPublisherService (twilio-messaging)', () => {
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
    await svc.publish('bms.campaigns' as any, 'campaign.tracked', { id: 1 }, { tag: 'v1', count: 3, ok: true });
    const call = publishMock.mock.calls[0][0];
    expect(call.exchange).toBe('bms.campaigns');
    expect(call.routingKey).toBe('campaign.tracked');
    expect(call.headers).toEqual({ tag: 'v1', count: 3, ok: 'true' });
  });

  it('close() delegates to publisher', async () => {
    const svc = new EventPublisherService();
    await svc.close();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
