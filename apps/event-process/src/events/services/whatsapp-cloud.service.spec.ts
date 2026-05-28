import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../providers/redis/redis.service';
import { WhatsappCloudService } from './whatsapp-cloud.service';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MsgopsService } from '../../msgops/msgops.service';
import { EventPublisherService } from '../../event-publisher.service';
import { CacheService } from '../../msgops/cache.service';
import { GEO_PROVIDER_TOKEN } from '@bms/geo';
import { AnalyticsPublisherProvider } from '../../providers/analytics-publisher.provider';
import { WhatsappCloudEvent } from '../interfaces/events.interfaces';

describe('WhatsappCloudService', () => {
  let service: WhatsappCloudService;

  const mockPipeline = {
    set: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
    hincrby: jest.fn().mockReturnThis(),
    hset: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
  };
  const mockRedisClient = {
    pipeline: jest.fn(() => mockPipeline),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    exists: jest.fn().mockResolvedValue(0),
  };
  const mockRedisService = { getOrThrow: jest.fn(() => mockRedisClient) };
  const mockFormatterUtils = {
    logInfo: jest.fn(),
    convertTimestampToTimezone: jest.fn(() => '2026-05-28'),
    removeQueryStringFromUrl: jest.fn((url) => url),
  };
  const mockMsgopsService = {
    checkPostgresConnection: jest.fn().mockResolvedValue(undefined),
    getAccountTimeZone: jest.fn().mockResolvedValue('UTC'),
    saveEventsLogs: jest.fn().mockResolvedValue({}),
  };
  const mockEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const mockCacheService = { get: jest.fn(), set: jest.fn() };
  const mockGeo = { lookup: jest.fn().mockResolvedValue(null) };
  const mockAnalytics = { publish: jest.fn().mockResolvedValue(undefined) };

  const makeEvent = (overrides: Partial<WhatsappCloudEvent> = {}): WhatsappCloudEvent => ({
    wamid: 'wamid.X',
    event: 'delivered',
    accountId: 7,
    contactId: 42,
    campaignId: 99,
    messageId: 11,
    utmCampaign: 'camp_1',
    timestamp: 1716800000000,
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappCloudService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: FormatterUtils, useValue: mockFormatterUtils },
        { provide: MsgopsService, useValue: mockMsgopsService },
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: CacheService, useValue: mockCacheService },
        { provide: GEO_PROVIDER_TOKEN, useValue: mockGeo },
        { provide: AnalyticsPublisherProvider, useValue: mockAnalytics },
      ],
    }).compile();
    service = module.get(WhatsappCloudService);
  });

  it('checks postgres connection', async () => {
    await service.processWhatsappCloudEvent(makeEvent());
    expect(mockMsgopsService.checkPostgresConnection).toHaveBeenCalled();
  });

  it('delivered: increments statistics and writes CH log with message_type=whatsapp (AC2)', async () => {
    await service.processWhatsappCloudEvent(makeEvent({ event: 'delivered' }));
    // statistics increment for 'delivered'
    expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.any(String), 'delivered', 1);
    // CH log
    const logged = mockMsgopsService.saveEventsLogs.mock.calls[0][0][0];
    expect(logged).toMatchObject({
      messageType: 'whatsapp',
      event: 'delivered',
      contactId: 42,
      campaignId: 99,
      delivered_id: 'wamid.X',
    });
    expect(mockAnalytics.publish).toHaveBeenCalled();
  });

  it("read maps to the 'open' statistics key (so %open widget moves) (AC3)", async () => {
    await service.processWhatsappCloudEvent(makeEvent({ event: 'read' }));
    expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.any(String), 'open', 1);
    const logged = mockMsgopsService.saveEventsLogs.mock.calls[0][0][0];
    expect(logged.event).toBe('open');
  });

  it('failed maps to bounce and carries error info in the log (AC4)', async () => {
    await service.processWhatsappCloudEvent(
      makeEvent({
        event: 'failed',
        errorCode: 131026,
        errorTitle: 'Message undeliverable',
        properties: { error_code: 131026 },
      }),
    );
    expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.any(String), 'bounce', 1);
    const logged = mockMsgopsService.saveEventsLogs.mock.calls[0][0][0];
    expect(logged.event).toBe('bounce');
    expect(logged.reason).toBe('Message undeliverable');
  });

  it('inbound: writes CH log event=inbound, skips per-campaign statistics', async () => {
    await service.processWhatsappCloudEvent(
      makeEvent({ event: 'inbound', campaignId: undefined, messageId: undefined, properties: { text_body: 'Olá!' } }),
    );
    // no campaign/automation correlation → statistics skipped
    expect(mockPipeline.hincrby).not.toHaveBeenCalled();
    const logged = mockMsgopsService.saveEventsLogs.mock.calls[0][0][0];
    expect(logged.event).toBe('inbound');
    expect(logged.properties).toMatchObject({ text_body: 'Olá!', wamid: 'wamid.X' });
  });

  it('unknown wamid (no campaign/contact correlation): skips statistics but still logs (AC10)', async () => {
    await service.processWhatsappCloudEvent(
      makeEvent({ event: 'delivered', contactId: undefined, campaignId: undefined, messageId: undefined }),
    );
    expect(mockPipeline.hincrby).not.toHaveBeenCalled();
    expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalled();
  });

  it('returns early on unhandled verb', async () => {
    await service.processWhatsappCloudEvent(makeEvent({ event: 'bogus' }));
    expect(mockMsgopsService.saveEventsLogs).not.toHaveBeenCalled();
  });
});
