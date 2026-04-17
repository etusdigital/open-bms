import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { MsgopsService } from './msgops/msgops.service';
import { PubSubProvider } from './providers/pubsub.provider';
import { Utils } from './utils/index.utils';
import { CampaignMessageType } from './interfaces';

// Mock EvolutionProvider before importing AppService
jest.mock('./providers/evolution.provider', () => {
  return {
    EvolutionProvider: jest.fn().mockImplementation(() => ({
      sendWhatsappTemplate: jest.fn().mockResolvedValue({ id: 'evo-msg-1' }),
    })),
  };
});

describe('AppService', () => {
  let service: AppService;

  const mockPubSubProvider = {
    sendMessage: jest.fn().mockResolvedValue({ messageId: 'pub-1', message: 'published', status: true }),
  };

  const mockMsgopsService = {
    createShortLink: jest.fn().mockResolvedValue('https://short.link/abc123'),
  };

  const mockUtils = {
    parsePubSubMessage: jest.fn(),
    stripString: jest.fn((text: string) => text),
    getVariables: jest.fn(),
    parseVariables: jest.fn(),
    hasVariable: jest.fn(),
    mapVariables: jest.fn(),
    getCustomFieldContact: jest.fn(),
  };

  const baseAccount = {
    id: 1,
    name: 'Test Account',
    accountConfigs: [
      { accountId: 1, name: 'whatsapp_number_id', value: 'inst-1', description: null },
      { accountId: 1, name: 'whatsapp_access_token', value: 'token-1', description: null },
      { accountId: 1, name: 'default_language', value: 'pt_BR', description: null },
      { accountId: 1, name: 'default_domain', value: 'example.com', description: null },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: PubSubProvider, useValue: mockPubSubProvider },
        { provide: MsgopsService, useValue: mockMsgopsService },
        { provide: Utils, useValue: mockUtils },
      ],
    }).compile();

    service = module.get<AppService>(AppService);

    jest.clearAllMocks();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(service.getHello()).toBe('Hello World!');
    });
  });

  describe('configByName', () => {
    it('should return config value from array-style accountConfigs', () => {
      const result = service.configByName(baseAccount as any, 'whatsapp_number_id');
      expect(result).toBe('inst-1');
    });

    it('should return empty string when config key not found in array', () => {
      const result = service.configByName(baseAccount as any, 'nonexistent');
      expect(result).toBe('');
    });

    it('should return config value from object-style accountConfigs', () => {
      const account = { id: 1, accountConfigs: { whatsapp_number_id: 'inst-2' } };
      const result = service.configByName(account as any, 'whatsapp_number_id');
      expect(result).toBe('inst-2');
    });

    it('should return default language when not configured', () => {
      const account = { id: 1, accountConfigs: [] };
      const result = service.configByName(account as any, 'default_language');
      expect(result).toBe('');
    });
  });

  describe('processCampaign', () => {
    const campaignMessage = {
      account: baseAccount,
      campaign_id: 100,
      campaign_name: 'test-campaign',
      campaign_test_ab_mode: false,
      campaign: { id: 50, name: 'Test Campaign', type: 'simple' },
      contacts: [
        { id: 1, uuid: 'uuid-1', whatsapp: '+5511999999999', token: 't' },
        { id: 2, uuid: 'uuid-2', whatsapp: '+5511888888888', token: 't2' },
      ],
      message: { id: 1, accountId: 1, title: 'Test', name: 'test-msg', content: 'Hello', type: CampaignMessageType.WHATSAPP, providerMessageId: 'tmpl-1' },
      page: 1,
      totalPages: 1,
    };

    it('should process all contacts and send tracker', async () => {
      const result = await service.processCampaign(campaignMessage as any);
      expect(result).toEqual({ status: 201, message: 'ok' });
      expect(mockPubSubProvider.sendMessage).toHaveBeenCalled();
    });

    it('should return 400 when account has no whatsapp_number_id', async () => {
      const badAccount = { id: 1, accountConfigs: [] };
      const msg = { ...campaignMessage, account: badAccount };
      const result = await service.processCampaign(msg as any);
      expect(result).toEqual({ status: 400, message: 'Invalid account configuration' });
    });

    it('should return 400 when account has no whatsapp_access_token', async () => {
      const badAccount = {
        id: 1,
        accountConfigs: [{ accountId: 1, name: 'whatsapp_number_id', value: 'inst-1', description: null }],
      };
      const msg = { ...campaignMessage, account: badAccount };
      const result = await service.processCampaign(msg as any);
      expect(result).toEqual({ status: 400, message: 'Invalid account configuration' });
    });

    it('should call createRedictLink when message has url', async () => {
      const msgWithUrl = {
        ...campaignMessage,
        message: { ...campaignMessage.message, url: 'https://example.com/page' },
      };
      await service.processCampaign(msgWithUrl as any);
      expect(mockMsgopsService.createShortLink).toHaveBeenCalled();
    });

    it('should not call createRedictLink when message has no url', async () => {
      const msgNoUrl = {
        ...campaignMessage,
        message: { ...campaignMessage.message, url: undefined },
      };
      await service.processCampaign(msgNoUrl as any);
      expect(mockMsgopsService.createShortLink).not.toHaveBeenCalled();
    });

    it('should send SENT_WHATSAPP_BATCH tracker for whatsapp type', async () => {
      await service.processCampaign(campaignMessage as any);
      const trackerCall = mockPubSubProvider.sendMessage.mock.calls[0];
      expect(trackerCall[0].event).toBe('SENT_WHATSAPP_BATCH');
    });

    it('should send SENT_SMS_BATCH tracker for sms type', async () => {
      const smsMsg = {
        ...campaignMessage,
        message: { ...campaignMessage.message, type: CampaignMessageType.SMS },
      };
      await service.processCampaign(smsMsg as any);
      const trackerCall = mockPubSubProvider.sendMessage.mock.calls[0];
      expect(trackerCall[0].event).toBe('SENT_SMS_BATCH');
    });
  });

  describe('processAutomation', () => {
    const automationMessage = {
      startedAt: Date.now(),
      automationId: 1,
      automationName: 'Test Auto',
      automationType: 'email' as const,
      utmContent: 'bms',
      utmCampaign: 'test-e1-01',
      next: { pubName: 'msgops.next.topic', data: { id: 'lead-1' } },
      messageId: 'msg-auto-1',
      message: { id: 1, accountId: 1, title: 'Test', name: 'test', content: 'Hello', type: 'whatsapp', providerMessageId: 'tmpl-2' },
      contact: { id: 1, uuid: 'uuid-1', whatsapp: '+5511999999999', hasWhatsapp: true, token: 't' },
      account: baseAccount,
    };

    it('should send whatsapp and publish to next topic', async () => {
      const result = await service.processAutomation(automationMessage as any);
      expect(result.status).toBe(true);
      expect(mockPubSubProvider.sendMessage).toHaveBeenCalledWith(automationMessage.next.data, automationMessage.next.pubName);
    });

    it('should return 400 when account has invalid config', async () => {
      const msg = { ...automationMessage, account: { id: 1, accountConfigs: [] } };
      const result = await service.processAutomation(msg as any);
      expect(result).toEqual({ status: 400, message: 'Invalid account configuration' });
    });

    it('should call invalidContact when contact has no whatsapp', async () => {
      const msg = { ...automationMessage, contact: { ...automationMessage.contact, hasWhatsapp: false } };
      const result = await service.processAutomation(msg as any);
      expect(result.status).toBe(true);
      expect(result.message).toContain('Invalid contact');
    });

    it('should return message about missing next when next has no pubName', async () => {
      const msg = { ...automationMessage, next: { pubName: '', data: {} } };
      const result = await service.processAutomation(msg as any);
      expect(result.status).toBe(true);
      expect(result.message).toContain('does not have the next filled in');
    });

    it('should return message about missing next when next is null/undefined', async () => {
      const msg = { ...automationMessage, next: null };
      const result = await service.processAutomation(msg as any);
      expect(result.status).toBe(true);
      expect(result.message).toContain('does not have the next filled in');
    });

    it('should call createRedictLink when message has url', async () => {
      const msg = {
        ...automationMessage,
        message: { ...automationMessage.message, url: 'https://example.com' },
      };
      await service.processAutomation(msg as any);
      expect(mockMsgopsService.createShortLink).toHaveBeenCalled();
    });
  });

  describe('invalidContact', () => {
    it('should send to next topic when next is available', async () => {
      const contact = { id: 42, token: 't' };
      const automationMessage = {
        messageId: 'msg-1',
        next: { pubName: 'next-topic', data: { id: 'lead-1' } },
      };
      const result = await service.invalidContact(contact as any, automationMessage as any);
      expect(result.status).toBe(true);
      expect(result.message).toContain('Invalid contact: 42');
      expect(mockPubSubProvider.sendMessage).toHaveBeenCalledWith(automationMessage.next.data, automationMessage.next.pubName);
    });

    it('should not send to next topic when next is not available', async () => {
      const contact = { id: 42, token: 't' };
      const automationMessage = { messageId: 'msg-1', next: null };
      const result = await service.invalidContact(contact as any, automationMessage as any);
      expect(result.status).toBe(true);
      expect(mockPubSubProvider.sendMessage).not.toHaveBeenCalled();
    });

    it('should not send to next topic when next has no pubName', async () => {
      const contact = { id: 42, token: 't' };
      const automationMessage = { messageId: 'msg-1', next: { pubName: '', data: {} } };
      const result = await service.invalidContact(contact as any, automationMessage as any);
      expect(result.status).toBe(true);
      expect(mockPubSubProvider.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('sendTracker', () => {
    it('should publish tracker event to configured topic', async () => {
      const originalEnv = process.env.TOPIC_MSGOPS_CAMPAIGN_EVENTS_TRACKER;
      process.env.TOPIC_MSGOPS_CAMPAIGN_EVENTS_TRACKER = 'tracker-topic';

      const campaignMessage = {
        campaign_id: 100,
        message: { id: 1, content: 'Hello' },
        page: 1,
        totalPages: 1,
        campaign_test_ab_mode: false,
      };

      await service.sendTracker('SENT_WHATSAPP_BATCH', campaignMessage as any, 10);

      expect(mockPubSubProvider.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          campaign_id: 100,
          event: 'SENT_WHATSAPP_BATCH',
          service: 'MSGOPS_SEND_BATCH_EVOLUTION',
          contacts_length: 10,
        }),
        'tracker-topic',
      );

      process.env.TOPIC_MSGOPS_CAMPAIGN_EVENTS_TRACKER = originalEnv;
    });
  });

  describe('createRedictLink', () => {
    it('should append UTMs and create short link', async () => {
      await service.createRedictLink('https://example.com', 'key=val', 'whatsapp', 'campaign-1', 'https://base.com');
      expect(mockMsgopsService.createShortLink).toHaveBeenCalledWith(expect.stringContaining('utm_source=bms'), 'https://base.com');
    });

    it('should use ? separator for URLs without query params', async () => {
      await service.createRedictLink('https://example.com', 'key=val', 'whatsapp', 'campaign-1', '');
      const calledUrl = mockMsgopsService.createShortLink.mock.calls[0][0];
      expect(calledUrl).toMatch(/^https:\/\/example\.com\?key=val/);
    });

    it('should use & separator for URLs with existing query params', async () => {
      await service.createRedictLink('https://example.com?foo=bar', 'key=val', 'whatsapp', 'campaign-1', '');
      const calledUrl = mockMsgopsService.createShortLink.mock.calls[0][0];
      expect(calledUrl).toMatch(/^https:\/\/example\.com\?foo=bar&key=val/);
    });

    it('should not duplicate utm_source if already present', async () => {
      await service.createRedictLink('https://example.com?utm_source=custom', 'key=val', 'whatsapp', 'campaign-1', '');
      const calledUrl = mockMsgopsService.createShortLink.mock.calls[0][0];
      const matches = calledUrl.match(/utm_source/g);
      expect(matches.length).toBe(1);
    });

    it('should not duplicate utm_medium if already present', async () => {
      await service.createRedictLink('https://example.com?utm_medium=custom', 'key=val', 'whatsapp', 'campaign-1', '');
      const calledUrl = mockMsgopsService.createShortLink.mock.calls[0][0];
      const matches = calledUrl.match(/utm_medium/g);
      expect(matches.length).toBe(1);
    });

    it('should not duplicate utm_campaign if already present', async () => {
      await service.createRedictLink('https://example.com?utm_campaign=custom', 'key=val', 'whatsapp', 'campaign-1', '');
      const calledUrl = mockMsgopsService.createShortLink.mock.calls[0][0];
      const matches = calledUrl.match(/utm_campaign/g);
      expect(matches.length).toBe(1);
    });
  });
});
