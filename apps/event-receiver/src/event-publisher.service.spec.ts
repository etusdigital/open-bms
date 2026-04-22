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
      ['sendgrid', 'sendgrid'],
      ['TWILIO', 'twilio'],
      ['custom_events', 'custom'],
      ['sparkpost', 'sparkpost'],
      ['push', 'push'],
      ['webhook', 'webhook'],
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

    it('long random string falls back to unknown (cardinality protection)', () => {
      expect(sanitizePlatform('malicious-payload-with-very-long-cardinality-explosion')).toBe('unknown');
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
    it('publishes to event.received.sendgrid with string+number headers', async () => {
      await service.publish({ type: 'x' }, { platform: 'sendgrid', extra: 'y', count: 3 });
      expect(publishMock).toHaveBeenCalledWith({
        exchange: 'bms.events',
        routingKey: 'event.received.sendgrid',
        payload: { type: 'x' },
        headers: { platform: 'sendgrid', extra: 'y', count: 3 },
      });
    });

    it('maps empty attributes to event.received.unknown', async () => {
      await service.publish({}, {});
      expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({ routingKey: 'event.received.unknown' }));
    });

    it('normalizes custom_events to custom', async () => {
      await service.publish({}, { platform: 'custom_events' });
      expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({ routingKey: 'event.received.custom' }));
    });

    it('drops boolean header with warn in dev', async () => {
      await service.publish({}, { platform: 'sendgrid', tracked: true });
      expect(publishMock).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { platform: 'sendgrid' },
        }),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[EventPublisher] dropping non-string/number header:',
        'tracked',
        'boolean',
      );
    });

    it('drops object header', async () => {
      await service.publish({}, { platform: 'sendgrid', meta: { a: 1 } });
      expect(publishMock).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { platform: 'sendgrid' },
        }),
      );
    });
  });

  describe('lifecycle', () => {
    it('onModuleInit triggers warmup publish', async () => {
      publishMock.mockClear();
      await service.onModuleInit();
      expect(publishMock).toHaveBeenCalledWith({
        exchange: 'bms.events',
        routingKey: 'event.received.warmup.ignore',
        payload: { warmup: true },
      });
    });

    it('close() delegates to publisher.close()', async () => {
      await service.close();
      expect(closeMock).toHaveBeenCalledTimes(1);
    });
  });
});
