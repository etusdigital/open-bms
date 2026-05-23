jest.mock('@bms/messaging', () => ({
  AmqpPublisher: jest.fn(),
  AmqpConsumer: jest.fn(),
  createHttpBridgeHandler: jest.fn(),
  EXCHANGES: {
    email: 'bms.email',
    events: 'bms.events',
    leads: 'bms.leads',
    campaigns: 'bms.campaigns',
    triggers: 'bms.triggers',
    push: 'bms.push',
    whatsapp: 'bms.whatsapp',
    sms: 'bms.sms',
    tags: 'bms.tags',
  },
  DLX: 'bms.dlx',
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { EventPublisherService } from './event-publisher.service';
import { MsgopsService } from './msgops/msgops.service';
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

  const mockEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockMsgopsService = {
    createShortLink: jest.fn().mockResolvedValue('https://short.link/abc123'),
  };

  const mockUtils = {
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
        { provide: EventPublisherService, useValue: mockEventPublisher },
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
      expect(mockEventPublisher.publish).toHaveBeenCalled();
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

    it('should call createRedirectLink when message has url', async () => {
      const msgWithUrl = {
        ...campaignMessage,
        message: { ...campaignMessage.message, url: 'https://example.com/page' },
      };
      await service.processCampaign(msgWithUrl as any);
      expect(mockMsgopsService.createShortLink).toHaveBeenCalled();
    });

    it('should not call createRedirectLink when message has no url', async () => {
      const msgNoUrl = {
        ...campaignMessage,
        message: { ...campaignMessage.message, url: undefined },
      };
      await service.processCampaign(msgNoUrl as any);
      expect(mockMsgopsService.createShortLink).not.toHaveBeenCalled();
    });

    it('should send SENT_WHATSAPP_BATCH tracker for whatsapp type', async () => {
      await service.processCampaign(campaignMessage as any);
      const trackerCall = mockEventPublisher.publish.mock.calls[0];
      // publish(exchange, routingKey, payload)
      expect(trackerCall[2].event).toBe('SENT_WHATSAPP_BATCH');
    });

    it('should send SENT_SMS_BATCH tracker for sms type', async () => {
      const smsMsg = {
        ...campaignMessage,
        message: { ...campaignMessage.message, type: CampaignMessageType.SMS },
      };
      await service.processCampaign(smsMsg as any);
      const trackerCall = mockEventPublisher.publish.mock.calls[0];
      expect(trackerCall[2].event).toBe('SENT_SMS_BATCH');
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
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('bms.triggers', 'trigger.process', automationMessage.next.data);
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

    it('should call createRedirectLink when message has url', async () => {
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
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('bms.triggers', 'trigger.process', automationMessage.next.data);
    });

    it('should not send to next topic when next is not available', async () => {
      const contact = { id: 42, token: 't' };
      const automationMessage = { messageId: 'msg-1', next: null };
      const result = await service.invalidContact(contact as any, automationMessage as any);
      expect(result.status).toBe(true);
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();
    });

    it('should not send to next topic when next has no pubName', async () => {
      const contact = { id: 42, token: 't' };
      const automationMessage = { messageId: 'msg-1', next: { pubName: '', data: {} } };
      const result = await service.invalidContact(contact as any, automationMessage as any);
      expect(result.status).toBe(true);
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe('sendTracker', () => {
    it('should publish tracker event to bms.campaigns/campaign.tracked', async () => {
      const campaignMessage = {
        campaign_id: 100,
        message: { id: 1, content: 'Hello' },
        page: 1,
        totalPages: 1,
        campaign_test_ab_mode: false,
      };

      await service.sendTracker('SENT_WHATSAPP_BATCH', campaignMessage as any, 10);

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'bms.campaigns',
        'campaign.tracked',
        expect.objectContaining({
          campaign_id: 100,
          event: 'SENT_WHATSAPP_BATCH',
          service: 'MSGOPS_SEND_BATCH_EVOLUTION',
          contacts_length: 10,
        }),
      );
    });
  });

  describe('createRedirectLink', () => {
    const externalAccount = { id: 1, name: 'External' } as any;

    it('should append UTMs and create short link', async () => {
      await service.createRedirectLink({
        url: 'https://example.com',
        utmsDefault: 'key=val',
        type: 'whatsapp',
        utmCampaign: 'campaign-1',
        baseUrl: 'https://base.com',
        account: externalAccount,
      });
      expect(mockMsgopsService.createShortLink).toHaveBeenCalledWith(expect.stringContaining('utm_source=bms'), 'https://base.com');
    });

    it('should use ? separator for URLs without query params', async () => {
      await service.createRedirectLink({
        url: 'https://example.com',
        utmsDefault: 'key=val',
        type: 'whatsapp',
        utmCampaign: 'campaign-1',
        baseUrl: '',
        account: externalAccount,
      });
      const calledUrl = mockMsgopsService.createShortLink.mock.calls[0][0];
      expect(calledUrl).toMatch(/^https:\/\/example\.com\?key=val/);
    });

    it('should use & separator for URLs with existing query params', async () => {
      await service.createRedirectLink({
        url: 'https://example.com?foo=bar',
        utmsDefault: 'key=val',
        type: 'whatsapp',
        utmCampaign: 'campaign-1',
        baseUrl: '',
        account: externalAccount,
      });
      const calledUrl = mockMsgopsService.createShortLink.mock.calls[0][0];
      expect(calledUrl).toMatch(/^https:\/\/example\.com\?foo=bar&key=val/);
    });

    it('should not duplicate utm_source if already present', async () => {
      await service.createRedirectLink({
        url: 'https://example.com?utm_source=custom',
        utmsDefault: 'key=val',
        type: 'whatsapp',
        utmCampaign: 'campaign-1',
        baseUrl: '',
        account: externalAccount,
      });
      const calledUrl = mockMsgopsService.createShortLink.mock.calls[0][0];
      const matches = calledUrl.match(/utm_source/g);
      expect(matches.length).toBe(1);
    });

    it('should not duplicate utm_medium if already present', async () => {
      await service.createRedirectLink({
        url: 'https://example.com?utm_medium=custom',
        utmsDefault: 'key=val',
        type: 'whatsapp',
        utmCampaign: 'campaign-1',
        baseUrl: '',
        account: externalAccount,
      });
      const calledUrl = mockMsgopsService.createShortLink.mock.calls[0][0];
      const matches = calledUrl.match(/utm_medium/g);
      expect(matches.length).toBe(1);
    });

    it('should not duplicate utm_campaign if already present', async () => {
      await service.createRedirectLink({
        url: 'https://example.com?utm_campaign=custom',
        utmsDefault: 'key=val',
        type: 'whatsapp',
        utmCampaign: 'campaign-1',
        baseUrl: '',
        account: externalAccount,
      });
      const calledUrl = mockMsgopsService.createShortLink.mock.calls[0][0];
      const matches = calledUrl.match(/utm_campaign/g);
      expect(matches.length).toBe(1);
    });

    it('should not modify the URL path with a trailing slash', async () => {
      await service.createRedirectLink({
        url: 'https://example.com/lp',
        utmsDefault: 'key=val',
        type: 'whatsapp',
        utmCampaign: 'campaign-1',
        baseUrl: '',
        account: externalAccount,
      });
      const calledUrl = mockMsgopsService.createShortLink.mock.calls[0][0];
      expect(calledUrl).toMatch(/^https:\/\/example\.com\/lp\?/);
      expect(calledUrl).not.toMatch(/\/lp\//);
    });
  });
});
