import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisherService, sanitizePlatform } from './event-publisher.service';

const publishMock = jest.fn().mockResolvedValue(undefined);
const closeMock = jest.fn().mockResolvedValue(undefined);
const AmqpPublisherMock = jest.fn().mockImplementation(() => ({
  publish: publishMock,
  close: closeMock,
}));

jest.mock('@bms/messaging', () => ({
  AmqpPublisher: jest.fn().mockImplementation((...args) => AmqpPublisherMock(...args)),
  EXCHANGES: { events: 'bms.events' },
}));

describe('EventPublisherService', () => {
  let service: EventPublisherService;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  const originalAmqpUrl = process.env.AMQP_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    publishMock.mockClear();
    closeMock.mockClear();
    AmqpPublisherMock.mockClear();
    process.env.AMQP_URL = 'amqp://guest:guest@localhost:5672';
    process.env.NODE_ENV = 'development';
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [EventPublisherService],
    }).compile();

    service = module.get<EventPublisherService>(EventPublisherService);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
    process.env.AMQP_URL = originalAmqpUrl;
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('sanitizePlatform', () => {
    it.each([
      ['twilio', 'twilio'],
      ['TWILIO', 'twilio'],
      ['internal', 'internal'],
      ['INTERNAL', 'internal'],
      ['custom_events', 'custom'],
      ['sendgrid', 'sendgrid'],
      ['push', 'push'],
    ])('maps %s -> %s', (input, expected) => {
      expect(sanitizePlatform(input)).toBe(expected);
    });

    it('maps invalid string to unknown with warn', () => {
      expect(sanitizePlatform('hacker<script>')).toBe('unknown');
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown platform "hacker<script>"'));
    });

    it('maps undefined to unknown', () => {
      expect(sanitizePlatform(undefined)).toBe('unknown');
    });

    it('maps number to unknown', () => {
      expect(sanitizePlatform(42)).toBe('unknown');
    });
  });

  describe('constructor', () => {
    it('throws when AMQP_URL is absent', async () => {
      delete process.env.AMQP_URL;
      await expect(
        Test.createTestingModule({
          providers: [EventPublisherService],
        }).compile(),
      ).rejects.toThrow('AMQP_URL environment variable is required');
    });
  });

  describe('publish', () => {
    it('publishes click event to event.received.twilio with headers', async () => {
      await service.publish({ payload: { event: 'click' } }, { platform: 'twilio', message_type: 'sms' });
      expect(publishMock).toHaveBeenCalledWith({
        exchange: 'bms.events',
        routingKey: 'event.received.twilio',
        payload: { payload: { event: 'click' } },
        headers: { platform: 'twilio', message_type: 'sms' },
      });
    });

    it('publishes redirect event to event.received.internal', async () => {
      await service.publish({ platform: 'internal', payload: [{ event: 'tracker-redirect' }] }, { platform: 'internal', message_type: 'tracker-redirect' });
      expect(publishMock).toHaveBeenCalledWith(
        expect.objectContaining({
          routingKey: 'event.received.internal',
          headers: { platform: 'internal', message_type: 'tracker-redirect' },
        }),
      );
    });

    it('maps empty attributes to event.received.unknown', async () => {
      await service.publish({}, {});
      expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({ routingKey: 'event.received.unknown' }));
    });

    it('coerces boolean header to string', async () => {
      await service.publish({}, { platform: 'twilio', tracked: true });
      expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({ headers: { platform: 'twilio', tracked: 'true' } }));
    });

    it('drops object header and always warns', async () => {
      await service.publish({}, { platform: 'twilio', meta: { nested: 1 } });
      expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({ headers: { platform: 'twilio' } }));
      expect(consoleWarnSpy).toHaveBeenCalledWith('[EventPublisher] dropping unsupported header type:', 'meta', 'object');
    });
  });

  describe('lifecycle', () => {
    it('close() delegates to publisher.close()', async () => {
      await service.close();
      expect(closeMock).toHaveBeenCalledTimes(1);
    });
  });
});
