import { AppService } from './app.service';
import { PubSubProvider } from './providers/pubsub.provider';
import { RedisService } from './providers/redis/redis.service';
import { MsgopsService } from './msgops/msgops.service';
import { Utils } from './utils/index.utils';

describe('AppService', () => {
  let service: AppService;
  let pubSubProvider: PubSubProvider;
  let redisService: RedisService;
  let msgopsService: MsgopsService;
  let utils: Utils;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    redisService = { getClient: jest.fn().mockReturnValue(mockRedisClient) } as any;
    pubSubProvider = { sendMessage: jest.fn().mockResolvedValue({ messageId: 'msg-123', status: true }) } as any;
    msgopsService = { createShortLink: jest.fn().mockResolvedValue('https://short.link/abc') } as any;
    utils = new Utils();

    service = new AppService(pubSubProvider, redisService, msgopsService, utils);
  });

  const makeAccount = (configs: Record<string, string> = {}) => {
    const defaultConfigs: Record<string, string> = {
      twilio_secret: 'secret',
      twilio_sid: 'sid',
      twilio_sid_account: 'sid_account',
      twilio_sms_service: '+sms',
      twilio_whatsapp_service: '+whatsapp',
      default_domain: 'example.com',
      shortlink_base_url: 'https://short.link/',
      ...configs,
    };
    return {
      id: 1,
      name: 'Test Account',
      accountConfigs: Object.entries(defaultConfigs).map(([name, value]) => ({
        accountId: 1,
        name,
        value,
        description: null,
      })),
      customFields: [],
    };
  };

  const makeContact = (overrides: any = {}) => ({
    id: 1,
    uuid: 'uuid-123',
    token: 'token',
    phone: '+5511999999999',
    whatsapp: '+5511999999999',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.com',
    hasPhone: true,
    hasWhatsapp: true,
    ...overrides,
  });

  const makeMessage = (overrides: any = {}) => ({
    id: 1,
    accountId: 1,
    title: 'Test',
    name: 'test-msg',
    content: 'Hello %FIRSTNAME%',
    type: 'sms',
    ...overrides,
  });

  describe('getHello', () => {
    it('should return Hello World!', () => {
      expect(service.getHello()).toBe('Hello World!');
    });
  });

  describe('configByName', () => {
    it('should find config by name from array', () => {
      const account = makeAccount();
      expect(service.configByName(account, 'twilio_sid')).toBe('sid');
    });

    it('should return empty string if config not found in array', () => {
      const account = makeAccount();
      expect(service.configByName(account, 'nonexistent')).toBe('');
    });

    it('should handle object-style accountConfigs', () => {
      const account = { id: 1, accountConfigs: { twilio_sid: 'sid-value' } as any };
      expect(service.configByName(account, 'twilio_sid')).toBe('sid-value');
    });

    it('should return undefined for missing key in object-style configs', () => {
      const account = { id: 1, accountConfigs: { foo: 'bar' } as any };
      expect(service.configByName(account, 'missing')).toBeUndefined();
    });
  });

  describe('getRedis', () => {
    it('should return parsed JSON when key exists', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ foo: 'bar' }));
      const result = await service.getRedis('some-key');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return undefined when key does not exist', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const result = await service.getRedis('missing-key');
      expect(result).toBeUndefined();
    });
  });

  describe('createRedirectLink', () => {
    it('should append utms with ? when url has no query params', async () => {
      await service.createRedirectLink({
        url: 'https://example.com',
        utmsDefault: 'foo=bar',
        type: 'sms',
        utmCampaign: 'campaign1',
        baseUrl: 'https://short.link/',
        account: makeAccount(),
      });
      expect(msgopsService.createShortLink).toHaveBeenCalled();
      const calledUrl = (msgopsService.createShortLink as jest.Mock).mock.calls[0][0];
      expect(calledUrl).toContain('?foo=bar');
      expect(calledUrl).toContain('utm_source=bms');
      expect(calledUrl).toContain('utm_medium=sms');
      expect(calledUrl).toContain('utm_campaign=campaign1');
    });

    it('should append utms with & when url already has query params', async () => {
      await service.createRedirectLink({
        url: 'https://example.com?existing=1',
        utmsDefault: 'foo=bar',
        type: 'sms',
        utmCampaign: 'campaign1',
        baseUrl: 'https://short.link/',
        account: makeAccount(),
      });
      const calledUrl = (msgopsService.createShortLink as jest.Mock).mock.calls[0][0];
      expect(calledUrl).toContain('&foo=bar');
    });

    it('should not add utm_source if already present', async () => {
      await service.createRedirectLink({
        url: 'https://example.com',
        utmsDefault: 'utm_source=custom',
        type: 'sms',
        utmCampaign: 'campaign1',
        baseUrl: '',
        account: makeAccount(),
      });
      const calledUrl = (msgopsService.createShortLink as jest.Mock).mock.calls[0][0];
      expect(calledUrl).not.toContain('utm_source=bms');
    });

    it('should not add utm_medium if already present', async () => {
      await service.createRedirectLink({
        url: 'https://example.com',
        utmsDefault: 'utm_medium=email',
        type: 'sms',
        utmCampaign: 'campaign1',
        baseUrl: '',
        account: makeAccount(),
      });
      const calledUrl = (msgopsService.createShortLink as jest.Mock).mock.calls[0][0];
      const mediumCount = (calledUrl.match(/utm_medium/g) || []).length;
      expect(mediumCount).toBe(1);
    });

    it('should not add utm_campaign if already present', async () => {
      await service.createRedirectLink({
        url: 'https://example.com',
        utmsDefault: 'utm_campaign=existing',
        type: 'sms',
        utmCampaign: 'campaign1',
        baseUrl: '',
        account: makeAccount(),
      });
      const calledUrl = (msgopsService.createShortLink as jest.Mock).mock.calls[0][0];
      const campaignCount = (calledUrl.match(/utm_campaign/g) || []).length;
      expect(campaignCount).toBe(1);
    });

    it('should add trailing slash to URL path for internal account', async () => {
      const internalAccount = { ...makeAccount(), isInternal: true };
      await service.createRedirectLink({
        url: 'https://example.com/lp',
        utmsDefault: 'foo=bar',
        type: 'sms',
        utmCampaign: 'campaign1',
        baseUrl: '',
        account: internalAccount,
      });
      const calledUrl = (msgopsService.createShortLink as jest.Mock).mock.calls[0][0];
      const queryIdx = calledUrl.indexOf('?');
      expect(queryIdx).toBeGreaterThan(-1);
      expect(calledUrl.slice(0, queryIdx)).toBe('https://example.com/lp/');
    });

    it('should not add trailing slash for external account', async () => {
      const externalAccount = { ...makeAccount(), isInternal: false };
      await service.createRedirectLink({
        url: 'https://example.com/lp',
        utmsDefault: 'foo=bar',
        type: 'sms',
        utmCampaign: 'campaign1',
        baseUrl: '',
        account: externalAccount,
      });
      const calledUrl = (msgopsService.createShortLink as jest.Mock).mock.calls[0][0];
      const queryIdx = calledUrl.indexOf('?');
      expect(queryIdx).toBeGreaterThan(-1);
      expect(calledUrl.slice(0, queryIdx)).toBe('https://example.com/lp');
    });
  });

  describe('processSingleSms', () => {
    it('should send SMS and return result', async () => {
      const message = {
        to: '+5511999999999',
        body: 'Hello',
        account: makeAccount(),
      };
      const result = await service.processSingleSms(message, '');
      // In test env, TwilioProvider.sendSingleSms returns undefined
      expect(result).toBeUndefined();
    });

    it('should delete redis key if provided', async () => {
      const message = {
        to: '+5511999999999',
        body: 'Hello',
        account: makeAccount(),
      };
      await service.processSingleSms(message, 'redis-key-123');
      expect(mockRedisClient.del).toHaveBeenCalledWith('redis-key-123');
    });

    it('should not delete redis key if empty', async () => {
      const message = {
        to: '+5511999999999',
        body: 'Hello',
        account: makeAccount(),
      };
      await service.processSingleSms(message, '');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('processCampaign', () => {
    it('should process SMS campaign and send tracker', async () => {
      const campaignMessage = {
        account: makeAccount(),
        campaign: { id: 1, name: 'test-campaign', type: 'simple' },
        contacts: [makeContact()],
        message: makeMessage({ type: 'sms' }),
        campaign_id: 1,
        campaign_name: 'test-campaign',
        page: 1,
        totalPages: 1,
      };
      const result = await service.processCampaign(campaignMessage as any, '');
      expect(result).toEqual({ status: 201, message: 'ok' });
      expect(pubSubProvider.sendMessage).toHaveBeenCalled();
    });

    it('should process WhatsApp campaign', async () => {
      const campaignMessage = {
        account: makeAccount(),
        campaign: { id: 1, name: 'test-campaign', type: 'simple' },
        contacts: [makeContact()],
        message: makeMessage({ type: 'whatsapp', providerMessageId: 'tmpl-1', url: '' }),
        campaign_id: 1,
        campaign_name: 'test-campaign',
        page: 1,
        totalPages: 1,
      };
      const result = await service.processCampaign(campaignMessage as any, '');
      expect(result).toEqual({ status: 201, message: 'ok' });
    });

    it('should process WhatsApp campaign with URL', async () => {
      const campaignMessage = {
        account: makeAccount(),
        campaign: { id: 1, name: 'test-campaign', type: 'simple' },
        contacts: [makeContact()],
        message: makeMessage({ type: 'whatsapp', providerMessageId: 'tmpl-1', url: 'https://example.com' }),
        campaign_id: 1,
        campaign_name: 'test-campaign',
        page: 1,
        totalPages: 1,
      };
      const result = await service.processCampaign(campaignMessage as any, '');
      expect(result).toEqual({ status: 201, message: 'ok' });
      expect(msgopsService.createShortLink).toHaveBeenCalled();
    });

    it('should process SMS campaign with URL', async () => {
      const campaignMessage = {
        account: makeAccount(),
        campaign: { id: 1, name: 'test-campaign', type: 'simple' },
        contacts: [makeContact()],
        message: makeMessage({ type: 'sms', url: 'https://example.com' }),
        campaign_id: 1,
        campaign_name: 'test-campaign',
        page: 1,
        totalPages: 1,
      };
      const result = await service.processCampaign(campaignMessage as any, '');
      expect(result).toEqual({ status: 201, message: 'ok' });
      expect(msgopsService.createShortLink).toHaveBeenCalled();
    });

    it('should delete redis key if provided', async () => {
      const campaignMessage = {
        account: makeAccount(),
        campaign: { id: 1, name: 'test-campaign', type: 'simple' },
        contacts: [makeContact()],
        message: makeMessage({ type: 'sms' }),
        campaign_id: 1,
        page: 1,
        totalPages: 1,
      };
      await service.processCampaign(campaignMessage as any, 'redis-key');
      expect(mockRedisClient.del).toHaveBeenCalledWith('redis-key');
    });

    it('should use campaign_name when campaign.name is not available', async () => {
      const campaignMessage = {
        account: makeAccount(),
        campaign: undefined,
        contacts: [makeContact()],
        message: makeMessage({ type: 'sms' }),
        campaign_id: 1,
        campaign_name: 'fallback-name',
        page: 1,
        totalPages: 1,
      };
      const result = await service.processCampaign(campaignMessage as any, '');
      expect(result).toEqual({ status: 201, message: 'ok' });
    });

    it('should send SENT_WHATSAPP_BATCH tracker for whatsapp', async () => {
      const campaignMessage = {
        account: makeAccount(),
        campaign: { id: 1, name: 'test-campaign', type: 'simple' },
        contacts: [makeContact()],
        message: makeMessage({ type: 'whatsapp', providerMessageId: 'tmpl-1' }),
        campaign_id: 1,
        page: 1,
        totalPages: 1,
      };
      await service.processCampaign(campaignMessage as any, '');
      const trackerCall = (pubSubProvider.sendMessage as jest.Mock).mock.calls[0];
      expect(trackerCall[0].event).toBe('SENT_WHATSAPP_BATCH');
    });
  });

  describe('processAutomation', () => {
    const makeAutomationMessage = (overrides: any = {}) => ({
      startedAt: Date.now(),
      automationId: 1,
      automationName: 'Test Auto',
      automationType: 'email',
      utmContent: 'bms',
      utmCampaign: 'auto-campaign',
      contact: makeContact(),
      message: makeMessage({ type: 'sms' }),
      next: null,
      account: makeAccount(),
      messageId: 'msg-001',
      ...overrides,
    });

    it('should process SMS automation without next', async () => {
      const msg = makeAutomationMessage({ next: null });
      const result = await service.processAutomation(msg as any, '');
      expect(result).toEqual({
        status: true,
        message: '[msg-001] This message does not have the next filled in.',
      });
    });

    it('should process SMS automation with next and publish to pubsub', async () => {
      const msg = makeAutomationMessage({
        next: {
          pubName: 'next-topic',
          data: { id: 10, contact: { id: 5 } },
        },
      });
      const result = await service.processAutomation(msg as any, '');
      expect(result.status).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(pubSubProvider.sendMessage).toHaveBeenCalled();
    });

    it('should delete redis key if provided', async () => {
      const msg = makeAutomationMessage({
        next: { pubName: 'next-topic', data: { id: 10, contact: { id: 5 } } },
      });
      await service.processAutomation(msg as any, 'redis-key');
      expect(mockRedisClient.del).toHaveBeenCalledWith('redis-key');
    });

    it('should not delete redis key if empty', async () => {
      const msg = makeAutomationMessage({
        next: { pubName: 'next-topic', data: { id: 10, contact: { id: 5 } } },
      });
      await service.processAutomation(msg as any, '');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should process WhatsApp automation', async () => {
      const msg = makeAutomationMessage({
        message: makeMessage({ type: 'whatsapp', providerMessageId: 'tmpl-1' }),
        next: null,
      });
      const result = await service.processAutomation(msg as any, '');
      expect(result.status).toBe(true);
    });

    it('should process WhatsApp automation with URL', async () => {
      const msg = makeAutomationMessage({
        message: makeMessage({ type: 'whatsapp', providerMessageId: 'tmpl-1', url: 'https://example.com' }),
        next: null,
      });
      await service.processAutomation(msg as any, '');
      expect(msgopsService.createShortLink).toHaveBeenCalled();
    });

    it('should return invalid contact for WhatsApp if hasWhatsapp is false', async () => {
      const msg = makeAutomationMessage({
        message: makeMessage({ type: 'whatsapp', providerMessageId: 'tmpl-1' }),
        contact: makeContact({ hasWhatsapp: false }),
        next: null,
      });
      const result = await service.processAutomation(msg as any, '');
      expect(result.message).toContain('Invalid contact');
    });

    it('should return invalid contact for SMS if hasPhone is false', async () => {
      const msg = makeAutomationMessage({
        message: makeMessage({ type: 'sms' }),
        contact: makeContact({ hasPhone: false }),
        next: null,
      });
      const result = await service.processAutomation(msg as any, '');
      expect(result.message).toContain('Invalid contact');
    });

    it('should process SMS automation with URL', async () => {
      const msg = makeAutomationMessage({
        message: makeMessage({ type: 'sms', url: 'https://example.com' }),
        next: null,
      });
      await service.processAutomation(msg as any, '');
      expect(msgopsService.createShortLink).toHaveBeenCalled();
    });

    it('should handle next without pubName', async () => {
      const msg = makeAutomationMessage({
        next: { pubName: '', data: {} },
      });
      const result = await service.processAutomation(msg as any, '');
      expect(result.message).toContain('does not have the next filled in');
    });
  });

  describe('invalidContact', () => {
    it('should log and return error message', async () => {
      const contact = makeContact();
      const automationMessage = {
        messageId: 'msg-001',
        next: null,
      } as any;
      const result = await service.invalidContact(contact, automationMessage);
      expect(result.status).toBe(true);
      expect(result.message).toContain('Invalid contact: 1');
    });

    it('should send to next pubName if available', async () => {
      const contact = makeContact();
      const automationMessage = {
        messageId: 'msg-001',
        next: { pubName: 'next-topic', data: { foo: 'bar' } },
      } as any;
      await service.invalidContact(contact, automationMessage);
      expect(pubSubProvider.sendMessage).toHaveBeenCalledWith({ foo: 'bar' }, 'next-topic');
    });

    it('should not send to pubsub if next has no pubName', async () => {
      const contact = makeContact();
      const automationMessage = {
        messageId: 'msg-001',
        next: { pubName: '', data: {} },
      } as any;
      await service.invalidContact(contact, automationMessage);
      expect(pubSubProvider.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('sendTracker', () => {
    it('should send tracker event to pubsub', async () => {
      const campaignMessage = {
        campaign_id: 1,
        message: { id: 1, content: 'test' },
        page: 1,
        totalPages: 1,
        campaign_test_ab_mode: false,
      } as any;
      process.env.TOPIC_MSGOPS_CAMPAIGN_EVENTS_TRACKER = 'tracker-topic';
      await service.sendTracker('SENT_SMS_BATCH', campaignMessage, 10);
      expect(pubSubProvider.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'SENT_SMS_BATCH',
          contacts_length: 10,
          service: 'MSGOPS_SEND_BATCH_TWILIO',
        }),
        'tracker-topic',
      );
    });

    it('should pass additional data to tracker', async () => {
      const campaignMessage = {
        campaign_id: 1,
        message: { id: 1, content: 'test' },
        page: 1,
        totalPages: 1,
        campaign_test_ab_mode: false,
      } as any;
      await service.sendTracker('SENT_SMS_BATCH', campaignMessage, 5, { extra: 'info' });
      expect(pubSubProvider.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ data: { extra: 'info' } }),
        expect.any(String),
      );
    });
  });
});
