import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../providers/redis/redis.service';
import { InternalEventsService } from './internal-events.service';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MsgopsService } from '../../msgops/msgops.service';
import { PubSubProvider } from '../../providers/pubsub.provider';
import { CacheService } from '../../msgops/cache.service';
import { GeolocationService } from '../../utils/geolocation/geolocation.service';
import { KafkaProvider } from '../../providers/kafka.provider';
import { InternalRequest } from '../interfaces/events.interfaces';

describe('InternalEventsService', () => {
  let service: InternalEventsService;

  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
  };

  const mockRedisService = {
    getOrThrow: jest.fn(() => mockRedisClient),
  };

  const mockFormatterUtils = {
    logInfo: jest.fn(),
    cleanObject: jest.fn((obj) => obj),
    normalizeTimestamp: jest.fn((ts) => ts),
    convertTimestampToTimezone: jest.fn(() => '2024-01-01'),
  };

  const mockMsgopsService = {
    checkPostgresConnection: jest.fn(),
    findAccountIdByApiKey: jest.fn(),
    getAccountTimeZone: jest.fn(),
    saveEventsLogs: jest.fn(),
    findContactById: jest.fn(),
  };

  const mockPubSubProvider = {
    sendAsyncMessage: jest.fn(),
    sendAsyncMessageBms: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockGeolocationService = {
    getLocation: jest.fn(),
  };

  const mockKafkaProvider = {
    sendAsyncMessage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalEventsService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: FormatterUtils, useValue: mockFormatterUtils },
        { provide: MsgopsService, useValue: mockMsgopsService },
        { provide: PubSubProvider, useValue: mockPubSubProvider },
        { provide: CacheService, useValue: mockCacheService },
        { provide: GeolocationService, useValue: mockGeolocationService },
        { provide: KafkaProvider, useValue: mockKafkaProvider },
      ],
    }).compile();

    service = module.get<InternalEventsService>(InternalEventsService);
  });

  describe('internalEventsProcess', () => {
    const baseEvent = {
      accountId: '1',
      contactId: 63321184,
      email: 'test@example.com',
      event: 'resubscribed',
      timestamp: Date.now(),
      properties: { reason: 'api request' },
    };

    const createRequest = (events: any[]): InternalRequest => ({
      platform: 'internal' as any,
      payload: events,
    });

    describe('validation', () => {
      it('should return early when payload is null', async () => {
        const request = { platform: 'internal' as any, payload: null } as any;

        await service.internalEventsProcess(request);

        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Invalid internal events'));
        expect(mockKafkaProvider.sendAsyncMessage).not.toHaveBeenCalled();
      });

      it('should return early when payload is not an array', async () => {
        const request = { platform: 'internal' as any, payload: 'not-an-array' } as any;

        await service.internalEventsProcess(request);

        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Invalid internal events'));
        expect(mockKafkaProvider.sendAsyncMessage).not.toHaveBeenCalled();
      });

      it('should skip event when accountId and apiKey are both missing', async () => {
        const request = createRequest([{ ...baseEvent, accountId: undefined, apiKey: undefined }]);

        await service.internalEventsProcess(request);

        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(
          expect.stringContaining('Account id and api key is empty'),
        );
      });

      it('should skip event when uuid and contactId are both missing', async () => {
        const request = createRequest([{ ...baseEvent, uuid: undefined, contactId: undefined }]);

        await service.internalEventsProcess(request);

        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(
          expect.stringContaining('Uuid or email or contactId is empty'),
        );
      });

      it('should skip event when uuid is longer than 40 characters', async () => {
        const longUuid = 'a'.repeat(41);
        const request = createRequest([{ ...baseEvent, uuid: longUuid }]);

        await service.internalEventsProcess(request);

        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Invalid uuid'));
      });

      it('should skip event when apiKey is invalid (account not found)', async () => {
        mockMsgopsService.findAccountIdByApiKey.mockResolvedValue(null);
        const request = createRequest([{ ...baseEvent, accountId: undefined, apiKey: 'invalid-key' }]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findAccountIdByApiKey).toHaveBeenCalledWith('invalid-key');
        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(
          expect.stringContaining('Account is empty or api key is invalid'),
        );
      });

      it('should return early when no valid events after filtering', async () => {
        const request = createRequest([{ ...baseEvent, accountId: undefined, apiKey: undefined }]);

        await service.internalEventsProcess(request);

        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(
          expect.stringContaining('No internal events to process'),
        );
        expect(mockKafkaProvider.sendAsyncMessage).not.toHaveBeenCalled();
      });
    });

    describe('accountId resolution', () => {
      it('should use accountId directly when provided', async () => {
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockKafkaProvider.sendAsyncMessage.mockResolvedValue(undefined);

        const request = createRequest([{ ...baseEvent, accountId: '123' }]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findAccountIdByApiKey).not.toHaveBeenCalled();
        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({ account_id: 123 }),
          undefined,
        );
      });

      it('should resolve accountId via apiKey when accountId is not provided', async () => {
        mockMsgopsService.findAccountIdByApiKey.mockResolvedValue(456);
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockKafkaProvider.sendAsyncMessage.mockResolvedValue(undefined);

        const request = createRequest([{ ...baseEvent, accountId: undefined, apiKey: 'valid-api-key' }]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findAccountIdByApiKey).toHaveBeenCalledWith('valid-api-key');
        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({ account_id: 456 }),
          undefined,
        );
      });
    });

    describe('timestamp handling', () => {
      beforeEach(() => {
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockKafkaProvider.sendAsyncMessage.mockResolvedValue(undefined);
      });

      it('should normalize timestamp when provided as string', async () => {
        const timestampStr = '1704067200000';
        mockFormatterUtils.normalizeTimestamp.mockReturnValue(Number(timestampStr));

        const request = createRequest([{ ...baseEvent, timestamp: timestampStr }]);

        await service.internalEventsProcess(request);

        expect(mockFormatterUtils.normalizeTimestamp).toHaveBeenCalled();
      });

      it('should normalize timestamp when provided as number', async () => {
        const timestampNum = 1704067200000;
        mockFormatterUtils.normalizeTimestamp.mockReturnValue(timestampNum);

        const request = createRequest([{ ...baseEvent, timestamp: timestampNum }]);

        await service.internalEventsProcess(request);

        expect(mockFormatterUtils.normalizeTimestamp).toHaveBeenCalledWith(timestampNum);
      });

      it('should use current time when timestamp is not provided', async () => {
        const now = Date.now();
        jest.spyOn(Date, 'now').mockReturnValue(now);

        const request = createRequest([{ ...baseEvent, timestamp: undefined }]);

        await service.internalEventsProcess(request);

        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            time: expect.any(Date),
          }),
          undefined,
        );

        jest.restoreAllMocks();
      });

      it('should limit timestamp to current time when timestamp is in the future', async () => {
        const now = Date.now();
        const futureTimestamp = now + 1000000;
        jest.spyOn(Date, 'now').mockReturnValue(now);
        mockFormatterUtils.normalizeTimestamp.mockReturnValue(futureTimestamp);

        const request = createRequest([{ ...baseEvent, timestamp: futureTimestamp }]);

        await service.internalEventsProcess(request);

        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            time: new Date(now),
          }),
          undefined,
        );

        jest.restoreAllMocks();
      });
    });

    describe('URL processing', () => {
      beforeEach(() => {
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockKafkaProvider.sendAsyncMessage.mockResolvedValue(undefined);
      });

      it('should extract query params from URL and add to properties', async () => {
        const request = createRequest([
          {
            ...baseEvent,
            url: 'https://example.com/page?utm_source=test&utm_campaign=demo',
            properties: { existing: 'value' },
          },
        ]);

        await service.internalEventsProcess(request);

        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            properties: expect.objectContaining({
              existing: 'value',
              utm_source: 'test',
              utm_campaign: 'demo',
            }),
            url: 'https://example.com/page',
          }),
          undefined,
        );
      });

      it('should keep URL as-is when no query params', async () => {
        const request = createRequest([{ ...baseEvent, url: 'https://example.com/page' }]);

        await service.internalEventsProcess(request);

        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://example.com/page',
          }),
          undefined,
        );
      });

      it('should skip event when URL is invalid', async () => {
        const request = createRequest([{ ...baseEvent, url: 'not-a-valid-url' }]);

        await service.internalEventsProcess(request);

        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Invalid url'));
      });

      it('should handle event without URL', async () => {
        const request = createRequest([{ ...baseEvent, url: undefined }]);

        await service.internalEventsProcess(request);

        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            url: null,
          }),
          undefined,
        );
      });
    });

    describe('geolocation', () => {
      beforeEach(() => {
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockKafkaProvider.sendAsyncMessage.mockResolvedValue(undefined);
      });

      it('should fetch geolocation data when IP is provided', async () => {
        mockGeolocationService.getLocation.mockResolvedValue({
          country: 'Brazil',
          region: 'SP',
          city: 'Sao Paulo',
        });

        const request = createRequest([{ ...baseEvent, ip: '192.168.1.1' }]);

        await service.internalEventsProcess(request);

        expect(mockGeolocationService.getLocation).toHaveBeenCalledWith('192.168.1.1');
        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            country: 'Brazil',
            region: 'SP',
            city: 'Sao Paulo',
          }),
          undefined,
        );
      });

      it('should not fetch geolocation when IP is not provided', async () => {
        const request = createRequest([{ ...baseEvent, ip: undefined }]);

        await service.internalEventsProcess(request);

        expect(mockGeolocationService.getLocation).not.toHaveBeenCalled();
      });
    });

    describe('persistence', () => {
      beforeEach(() => {
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockKafkaProvider.sendAsyncMessage.mockResolvedValue(undefined);
      });

      it('should call sendKafkaMessage for processed events', async () => {
        const request = createRequest([baseEvent]);

        await service.internalEventsProcess(request);

        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalled();
      });

      it('should call sendKafkaMessage for processed events with correct shape', async () => {
        const request = createRequest([baseEvent]);

        await service.internalEventsProcess(request);

        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            account_id: 1,
            event: 'resubscribed',
            contact_id: 63321184,
            email: 'test@example.com',
            message_type: 'internal',
          }),
          undefined,
        );
      });

      it('should return empty object on successful processing', async () => {
        const request = createRequest([baseEvent]);

        const result = await service.internalEventsProcess(request);

        expect(result).toEqual({});
      });

      it('should process multiple valid events in a single request', async () => {
        const request = createRequest([
          { ...baseEvent, contactId: 1 },
          { ...baseEvent, contactId: 2 },
          { ...baseEvent, contactId: 3 },
        ]);

        await service.internalEventsProcess(request);

        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalledTimes(3);
        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({ contact_id: 1 }),
          undefined,
        );
        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({ contact_id: 2 }),
          undefined,
        );
        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({ contact_id: 3 }),
          undefined,
        );
      });
    });
  });
});
