import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../providers/redis/redis.service';
import { InternalEventsService } from './internal-events.service';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MsgopsService } from '../../msgops/msgops.service';
import { EventPublisherService } from '../../event-publisher.service';
import { CacheService } from '../../msgops/cache.service';
import { GeolocationService } from '../../utils/geolocation/geolocation.service';
import { AnalyticsPublisherProvider } from '../../providers/analytics-publisher.provider';
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
    findContactByEmail: jest.fn(),
    findContactByUuid: jest.fn(),
    findMessageAssociation: jest.fn(),
  };

  const mockEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockGeolocationService = {
    getLocation: jest.fn(),
  };

  const mockAnalyticsPublisherProvider = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalEventsService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: FormatterUtils, useValue: mockFormatterUtils },
        { provide: MsgopsService, useValue: mockMsgopsService },
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: CacheService, useValue: mockCacheService },
        { provide: GeolocationService, useValue: mockGeolocationService },
        { provide: AnalyticsPublisherProvider, useValue: mockAnalyticsPublisherProvider },
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
        expect(mockAnalyticsPublisherProvider.publish).not.toHaveBeenCalled();
      });

      it('should return early when payload is not an array', async () => {
        const request = { platform: 'internal' as any, payload: 'not-an-array' } as any;

        await service.internalEventsProcess(request);

        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Invalid internal events'));
        expect(mockAnalyticsPublisherProvider.publish).not.toHaveBeenCalled();
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
        expect(mockAnalyticsPublisherProvider.publish).not.toHaveBeenCalled();
      });
    });

    describe('accountId resolution', () => {
      it('should use accountId directly when provided', async () => {
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockAnalyticsPublisherProvider.publish.mockResolvedValue(undefined);

        const request = createRequest([{ ...baseEvent, accountId: '123' }]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findAccountIdByApiKey).not.toHaveBeenCalled();
        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ account_id: 123 }),
        );
      });

      it('should resolve accountId via apiKey when accountId is not provided', async () => {
        mockMsgopsService.findAccountIdByApiKey.mockResolvedValue(456);
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockAnalyticsPublisherProvider.publish.mockResolvedValue(undefined);

        const request = createRequest([{ ...baseEvent, accountId: undefined, apiKey: 'valid-api-key' }]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findAccountIdByApiKey).toHaveBeenCalledWith('valid-api-key');
        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ account_id: 456 }),
        );
      });
    });

    describe('timestamp handling', () => {
      beforeEach(() => {
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockAnalyticsPublisherProvider.publish.mockResolvedValue(undefined);
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

        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            time: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/),
          }),
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

        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            time: new Date(now).toISOString().replace('T', ' ').replace('Z', ''),
          }),
        );

        jest.restoreAllMocks();
      });
    });

    describe('URL processing', () => {
      beforeEach(() => {
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockAnalyticsPublisherProvider.publish.mockResolvedValue(undefined);
      });

      it('should extract query params from URL and add non-redundant ones to properties', async () => {
        const request = createRequest([
          {
            ...baseEvent,
            url: 'https://example.com/page?utm_source=test&utm_campaign=demo&custom=keep',
            properties: { existing: 'value' },
          },
        ]);

        await service.internalEventsProcess(request);

        const [publishedPayload] = mockAnalyticsPublisherProvider.publish.mock.lastCall!;
        expect(publishedPayload.url).toBe('https://example.com/page');
        expect(JSON.parse(publishedPayload.properties)).toEqual(
          expect.objectContaining({
            existing: 'value',
            custom: 'keep',
          }),
        );
      });

      it('should keep URL as-is when no query params', async () => {
        const request = createRequest([{ ...baseEvent, url: 'https://example.com/page' }]);

        await service.internalEventsProcess(request);

        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://example.com/page',
          }),
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

        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            url: null,
          }),
        );
      });
    });

    describe('geolocation', () => {
      beforeEach(() => {
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockAnalyticsPublisherProvider.publish.mockResolvedValue(undefined);
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
        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            country: 'Brazil',
            region: 'SP',
            city: 'Sao Paulo',
          }),
        );
      });

      it('should not fetch geolocation when IP is not provided', async () => {
        const request = createRequest([{ ...baseEvent, ip: undefined }]);

        await service.internalEventsProcess(request);

        expect(mockGeolocationService.getLocation).not.toHaveBeenCalled();
      });
    });

    describe('contactId resolution', () => {
      beforeEach(() => {
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockAnalyticsPublisherProvider.publish.mockResolvedValue(undefined);
      });

      it('should resolve contactId from uuid when contactId is missing', async () => {
        mockMsgopsService.findContactByUuid.mockResolvedValue({ id: 42 });
        const request = createRequest([
          { ...baseEvent, contactId: undefined, email: undefined, uuid: '019901e4-773f-7008-ae1e-7842dce2f8c7' },
        ]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findContactByUuid).toHaveBeenCalledWith(1, '019901e4-773f-7008-ae1e-7842dce2f8c7');
        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ contact_id: 42 }),
        );
      });

      it('should populate email from uuid lookup when event email is missing', async () => {
        mockMsgopsService.findContactByUuid.mockResolvedValue({ id: 42, email: 'resolved@example.com' });
        const request = createRequest([{ ...baseEvent, contactId: undefined, email: undefined, uuid: 'abc' }]);

        await service.internalEventsProcess(request);

        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'resolved@example.com', contact_id: 42 }),
        );
      });

      it('should not overwrite email when event already has one', async () => {
        mockMsgopsService.findContactByUuid.mockResolvedValue({ id: 42, email: 'from-db@example.com' });
        const request = createRequest([
          { ...baseEvent, contactId: undefined, email: 'upstream@example.com', uuid: 'abc' },
        ]);
        mockMsgopsService.findContactByEmail.mockResolvedValue(null);

        await service.internalEventsProcess(request);

        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'upstream@example.com' }),
        );
      });

      it('should resolve contactId from email when contactId is missing and email is present', async () => {
        mockMsgopsService.findContactByEmail.mockResolvedValue({ id: 99 });
        const request = createRequest([
          { ...baseEvent, contactId: undefined, uuid: 'uuid-value', email: 'lookup@example.com' },
        ]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findContactByEmail).toHaveBeenCalledWith(1, 'lookup@example.com');
        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ contact_id: 99 }),
        );
      });

      it('should prefer email lookup over uuid lookup when both are present', async () => {
        mockMsgopsService.findContactByEmail.mockResolvedValue({ id: 99 });
        const request = createRequest([
          { ...baseEvent, contactId: undefined, uuid: 'uuid-value', email: 'lookup@example.com' },
        ]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findContactByEmail).toHaveBeenCalled();
        expect(mockMsgopsService.findContactByUuid).not.toHaveBeenCalled();
      });

      it('should not perform lookup when contactId is already present', async () => {
        const request = createRequest([{ ...baseEvent, contactId: 12345, uuid: 'uuid-value' }]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findContactByEmail).not.toHaveBeenCalled();
        expect(mockMsgopsService.findContactByUuid).not.toHaveBeenCalled();
        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ contact_id: 12345 }),
        );
      });

      it('should keep event with contactId null when uuid lookup returns no contact', async () => {
        mockMsgopsService.findContactByUuid.mockResolvedValue(null);
        const request = createRequest([{ ...baseEvent, contactId: undefined, email: undefined, uuid: 'unknown-uuid' }]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findContactByUuid).toHaveBeenCalledWith(1, 'unknown-uuid');
        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ contactId: null, uuid: 'unknown-uuid' }),
        );
      });

      it('should fall back to uuid lookup when email lookup returns no contact', async () => {
        mockMsgopsService.findContactByEmail.mockResolvedValue(null);
        mockMsgopsService.findContactByUuid.mockResolvedValue({ id: 77 });
        const request = createRequest([
          { ...baseEvent, contactId: undefined, uuid: 'uuid-value', email: 'missing@example.com' },
        ]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findContactByEmail).toHaveBeenCalledWith(1, 'missing@example.com');
        expect(mockMsgopsService.findContactByUuid).toHaveBeenCalledWith(1, 'uuid-value');
        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ contact_id: 77 }),
        );
      });
    });

    describe('utm_campaign enrichment', () => {
      const urlWithUtm =
        'https://pecaoseu.com/s1-sg-cartao/?utm_source=sendgrid&utm_campaign=cc_portobnk_hfnc_v1-32_e1_579367&bmsu=abc';

      beforeEach(() => {
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockAnalyticsPublisherProvider.publish.mockResolvedValue(undefined);
        mockMsgopsService.findMessageAssociation.mockResolvedValue({});
      });

      it('should populate utmCampaign from url query param', async () => {
        const request = createRequest([{ ...baseEvent, url: urlWithUtm }]);

        await service.internalEventsProcess(request);

        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ utm_campaign: 'cc_portobnk_hfnc_v1-32_e1_579367' }),
        );
      });

      it('should extract messageId from utm_campaign when not already provided', async () => {
        const request = createRequest([{ ...baseEvent, messageId: undefined, url: urlWithUtm }]);

        await service.internalEventsProcess(request);

        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ message_id: 579367 }),
        );
      });

      it('should populate campaignId when association resolves a campaign', async () => {
        mockMsgopsService.findMessageAssociation.mockResolvedValue({ campaignId: 42 });
        const request = createRequest([
          { ...baseEvent, messageId: undefined, campaignId: undefined, automationId: undefined, url: urlWithUtm },
        ]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findMessageAssociation).toHaveBeenCalledWith(1, 579367, 'cc_portobnk_hfnc_v1-32');
        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ campaign_id: 42, message_id: 579367 }),
        );
      });

      it('should populate automationId when association resolves an automation', async () => {
        mockMsgopsService.findMessageAssociation.mockResolvedValue({ automationId: 88 });
        const automationUrl = 'https://pecaoseu.com/x?utm_campaign=pecaoseu-fluxo-cc-e02-t3_e2_108456';
        const request = createRequest([
          { ...baseEvent, messageId: undefined, campaignId: undefined, automationId: undefined, url: automationUrl },
        ]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findMessageAssociation).toHaveBeenCalledWith(1, 108456, 'pecaoseu-fluxo-cc-e02-t3');
        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ automation_id: 88, message_id: 108456 }),
        );
      });

      it('should skip association lookup when utm_campaign does not match _eN_<id> pattern', async () => {
        const request = createRequest([
          { ...baseEvent, messageId: undefined, url: 'https://x.com/?utm_campaign=custom-value' },
        ]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findMessageAssociation).not.toHaveBeenCalled();
        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ utm_campaign: 'custom-value', message_id: undefined }),
        );
      });

      it('should not overwrite a messageId already present on the event', async () => {
        const request = createRequest([{ ...baseEvent, messageId: 111, url: urlWithUtm }]);

        await service.internalEventsProcess(request);

        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ message_id: 111 }),
        );
      });

      it('should not call association lookup when campaignId or automationId already present', async () => {
        const request = createRequest([{ ...baseEvent, messageId: 579367, campaignId: 42, url: urlWithUtm }]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findMessageAssociation).not.toHaveBeenCalled();
      });

      it('should not enrich when url has no utm_campaign', async () => {
        const request = createRequest([{ ...baseEvent, url: 'https://example.com/page' }]);

        await service.internalEventsProcess(request);

        expect(mockMsgopsService.findMessageAssociation).not.toHaveBeenCalled();
      });
    });

    describe('properties sanitization', () => {
      beforeEach(() => {
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockAnalyticsPublisherProvider.publish.mockResolvedValue(undefined);
        mockMsgopsService.findMessageAssociation.mockResolvedValue({});
      });

      it('should strip bmsu, bmsa, and utm_* from properties', async () => {
        const request = createRequest([
          {
            ...baseEvent,
            url: 'https://x.com/?bmsu=abc&bmsa=10&utm_source=sg&utm_medium=email&utm_content=hero&utm_campaign=camp_e1_111&keep=yes',
          },
        ]);

        await service.internalEventsProcess(request);

        const publishCall = mockAnalyticsPublisherProvider.publish.mock.calls[0][0];
        const publishProps = JSON.parse(publishCall.properties);
        expect(publishProps).not.toHaveProperty('bmsu');
        expect(publishProps).not.toHaveProperty('bmsa');
        expect(publishProps).not.toHaveProperty('utm_source');
        expect(publishProps).not.toHaveProperty('utm_medium');
        expect(publishProps).not.toHaveProperty('utm_content');
        expect(publishProps).not.toHaveProperty('utm_campaign');
        expect(publishProps).toMatchObject({ keep: 'yes' });
      });

      it('should still emit utm_campaign top-level column after stripping from properties', async () => {
        const request = createRequest([{ ...baseEvent, url: 'https://x.com/?utm_campaign=camp_e1_111' }]);

        await service.internalEventsProcess(request);

        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({ utm_campaign: 'camp_e1_111' }),
        );
      });
    });

    describe('persistence', () => {
      beforeEach(() => {
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockAnalyticsPublisherProvider.publish.mockResolvedValue(undefined);
      });

      it('should call sendAnalyticsEvent for processed events', async () => {
        const request = createRequest([baseEvent]);

        await service.internalEventsProcess(request);

        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalled();
      });

      it('should call sendAnalyticsEvent for processed events with correct shape', async () => {
        const request = createRequest([baseEvent]);

        await service.internalEventsProcess(request);

        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            account_id: 1,
            event: 'resubscribed',
            contact_id: 63321184,
            email: 'test@example.com',
            message_type: 'internal',
          }),
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

        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledTimes(3);
        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(expect.objectContaining({ contact_id: 1 }));
        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(expect.objectContaining({ contact_id: 2 }));
        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalledWith(expect.objectContaining({ contact_id: 3 }));
      });
    });

    // Hop 2 of the email click flow (tracker-redirect). When the user follows
    // a bmsclick link, apps/tracker publishes a platform='internal' event with
    // the real end-user IP. These tests guard that bot classification reaches
    // ClickHouse via properties, so we can later correlate with hop-1
    // click-webhook classifications to strip Gmail-prefetch noise.
    describe('bot signal stamping for tracker-redirect', () => {
      const trackerRedirectEvent = {
        accountId: '1',
        event: 'tracker-redirect',
        schemaVersion: 1,
        timestamp: Date.now(),
        uuid: 'bms-uuid-xyz',
        url: 'https://example.com/landing',
        ip: '8.8.8.8',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0',
      };

      beforeEach(() => {
        mockMsgopsService.getAccountTimeZone.mockResolvedValue('America/Sao_Paulo');
        mockAnalyticsPublisherProvider.publish.mockResolvedValue(undefined);
      });

      it('stamps is_datacenter=true, is_bot=false, bot_classification="datacenter" for a GCP hosting IP', async () => {
        mockGeolocationService.getLocation.mockResolvedValueOnce({
          country: 'US',
          region: 'CA',
          city: 'Mountain View',
          traits: {
            asn: 396982,
            asnOrg: 'Google LLC',
            isp: '',
            organization: '',
            userType: 'hosting',
            connectionType: '',
            isAnycast: false,
          },
        });

        const request = createRequest([trackerRedirectEvent]);
        await service.internalEventsProcess(request);

        expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalled();
        const [payload] = mockAnalyticsPublisherProvider.publish.mock.lastCall!;
        expect(payload.event).toBe('tracker-redirect');
        expect(JSON.parse(payload.properties)).toMatchObject({
          is_bot: false,
          is_datacenter: true,
          bot_classification: 'datacenter',
          asn: 396982,
          asn_org: 'Google LLC',
          user_type: 'hosting',
        });
      });

      it('UA denylist upgrades a hosting tracker-redirect with curl UA to is_bot=true (script_ua)', async () => {
        mockGeolocationService.getLocation.mockResolvedValueOnce({
          country: 'US',
          traits: {
            asn: 16509,
            asnOrg: 'Amazon.com, Inc.',
            isp: '',
            organization: '',
            userType: 'hosting',
            connectionType: '',
            isAnycast: false,
          },
        });

        const request = createRequest([{ ...trackerRedirectEvent, userAgent: 'curl/8.4.0' }]);
        await service.internalEventsProcess(request);

        const [payload] = mockAnalyticsPublisherProvider.publish.mock.lastCall!;
        expect(JSON.parse(payload.properties)).toMatchObject({
          is_bot: true,
          is_datacenter: true,
          bot_classification: 'script_ua',
          asn: 16509,
        });
      });

      it('stamps residential traits clean for a real user click', async () => {
        mockGeolocationService.getLocation.mockResolvedValueOnce({
          country: 'BR',
          region: 'SP',
          city: 'São Paulo',
          traits: {
            asn: 28573,
            asnOrg: 'Claro NXT Telecomunicacoes Ltda',
            isp: '',
            organization: '',
            userType: 'residential',
            connectionType: 'Cable/DSL',
            isAnycast: false,
          },
        });

        const request = createRequest([{ ...trackerRedirectEvent, ip: '177.1.1.1' }]);
        await service.internalEventsProcess(request);

        const [payload] = mockAnalyticsPublisherProvider.publish.mock.lastCall!;
        expect(JSON.parse(payload.properties)).toMatchObject({
          is_bot: false,
          is_datacenter: false,
          bot_classification: null,
          asn: 28573,
          user_type: 'residential',
        });
      });

      it('returns all-false bot signals when the event has no ip (geoData skipped)', async () => {
        const { ip: _ip, ...noIpEvent } = trackerRedirectEvent;
        const request = createRequest([noIpEvent]);
        await service.internalEventsProcess(request);

        expect(mockGeolocationService.getLocation).not.toHaveBeenCalled();
        const [payload] = mockAnalyticsPublisherProvider.publish.mock.lastCall!;
        expect(JSON.parse(payload.properties)).toMatchObject({
          is_bot: false,
          is_datacenter: false,
          bot_classification: null,
          asn: 0,
          asn_org: '',
          user_type: '',
        });
      });
    });
  });
});
