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
import { WhatsappChannelResolverService } from './providers/whatsapp-channel-resolver.service';

describe('AppService (Wave 5 — WhatsApp Cloud)', () => {
  let service: AppService;

  const mockEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
    publishWhatsappSend: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockMsgopsService = {
    createShortLink: jest.fn().mockResolvedValue('https://short.link/abc123'),
  };

  const mockProvider = {
    sendTemplate: jest.fn().mockResolvedValue({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.OK' }] }),
  };

  const mockResolver = {
    buildProvider: jest.fn().mockResolvedValue({ provider: mockProvider, channel: { id: 99, mode: 'meta' } }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: MsgopsService, useValue: mockMsgopsService },
        { provide: Utils, useClass: Utils },
        { provide: WhatsappChannelResolverService, useValue: mockResolver },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    jest.clearAllMocks();
  });

  describe('processCampaign', () => {
    it('returns 400 when account.id is missing', async () => {
      const r = await service.processCampaign({ account: {}, message: { id: 1, providerMessageId: 't' } } as any);
      expect(r.status).toBe(400);
      expect(mockResolver.buildProvider).not.toHaveBeenCalled();
    });

    it('returns 422 when the message has no providerMessageId (template not synced)', async () => {
      const r = await service.processCampaign({
        account: { id: 7, accountConfigs: [] },
        message: { id: 1, name: 'msg', type: 'whatsapp' },
        contacts: [],
      } as any);
      expect(r.status).toBe(422);
      expect(mockResolver.buildProvider).not.toHaveBeenCalled();
    });

    it('returns 400 when channel resolution fails (no active channel)', async () => {
      mockResolver.buildProvider.mockRejectedValueOnce(new Error('No active WhatsApp channel for account 7'));
      const r = await service.processCampaign({
        account: { id: 7, accountConfigs: [] },
        message: { id: 1, providerMessageId: 'order_update', type: 'whatsapp' },
        contacts: [{ id: 1, hasWhatsapp: true, whatsapp: '5511' }],
      } as any);
      expect(r.status).toBe(400);
    });

    it('sends one template per contact and emits a campaign tracker', async () => {
      const r = await service.processCampaign({
        account: { id: 7, accountConfigs: [{ name: 'default_language', value: 'pt_BR' }] },
        message: { id: 1, name: 'msg', type: 'whatsapp', providerMessageId: 'order_update' },
        contacts: [
          { id: 1, hasWhatsapp: true, whatsapp: '+5511999990001' },
          { id: 2, hasWhatsapp: true, whatsapp: '+5511999990002' },
          { id: 3, hasWhatsapp: false }, // skipped
        ],
        campaign: { id: 99, name: 'camp', type: 'simple' },
        campaign_id: 99,
      } as any);

      expect(r.status).toBe(201);
      expect(r.sent).toBe(3);
      expect(mockProvider.sendTemplate).toHaveBeenCalledTimes(2);
      expect(mockProvider.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          templateName: 'order_update',
          languageCode: 'pt_BR',
        }),
      );
      // tracker emitted
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'bms.campaigns',
        'campaign.tracked',
        expect.objectContaining({ service: 'MSGOPS_SEND_BATCH_WHATSAPP', event: 'SENT_WHATSAPP_BATCH' }),
      );
    });

    it('fills body parameters from contact data in the order the variables appear', async () => {
      await service.processCampaign({
        account: { id: 7, accountConfigs: [], customFields: [{ name: 'cidade' }] },
        message: {
          id: 1,
          name: 'msg',
          type: 'whatsapp',
          providerMessageId: 'live_invite',
          url: 'https://chat.whatsapp.com/x',
          content: 'Fala, %FIRSTNAME%, de %CIDADE%.\nAte mais, %FIRSTNAME%!',
        },
        contacts: [{ id: 1, hasWhatsapp: true, whatsapp: '+5511999990001', firstName: 'Ana', customFields: { cidade: 'BH' } }],
        campaign: { id: 99, name: 'camp', type: 'simple' },
        campaign_id: 99,
      } as any);

      expect(mockProvider.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          components: [
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'https://short.link/abc123' }] },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: 'Ana' },
                { type: 'text', text: 'BH' },
              ],
            },
          ],
        }),
      );
    });

    it('never sends an empty body parameter', async () => {
      await service.processCampaign({
        account: { id: 7, accountConfigs: [] },
        message: { id: 1, name: 'msg', type: 'whatsapp', providerMessageId: 'live_invite', content: 'Oi %FIRSTNAME%' },
        contacts: [{ id: 1, hasWhatsapp: true, whatsapp: '+5511999990001' }],
        campaign: { id: 99, name: 'camp', type: 'simple' },
        campaign_id: 99,
      } as any);

      expect(mockProvider.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ components: [{ type: 'body', parameters: [{ type: 'text', text: '-' }] }] }));
    });

    it('caps concurrent sends per page', async () => {
      let inFlight = 0;
      let peak = 0;
      mockProvider.sendTemplate.mockImplementation(async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return { messaging_product: 'whatsapp', messages: [{ id: 'wamid.OK' }] };
      });
      const contacts = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, hasWhatsapp: true, whatsapp: `+55119999900${i}` }));

      const r = await service.processCampaign({
        account: { id: 7, accountConfigs: [] },
        message: { id: 1, name: 'msg', type: 'whatsapp', providerMessageId: 'order_update' },
        contacts,
        campaign: { id: 99, name: 'camp', type: 'simple' },
        campaign_id: 99,
      } as any);

      expect(r.sent).toBe(40);
      expect(mockProvider.sendTemplate).toHaveBeenCalledTimes(40);
      expect(peak).toBeLessThanOrEqual(10);
      mockProvider.sendTemplate.mockResolvedValue({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.OK' }] });
    });

    // AC1 — wamid is persisted via publishWhatsappSend after a successful send.
    it('publishes the wamid→send mapping for each successful send', async () => {
      await service.processCampaign({
        account: { id: 7, accountConfigs: [{ name: 'default_language', value: 'pt_BR' }] },
        message: { id: 11, name: 'msg', type: 'whatsapp', providerMessageId: 'order_update' },
        contacts: [{ id: 42, uuid: 'u42', hasWhatsapp: true, whatsapp: '+5511999990001' }],
        campaign: { id: 99, name: 'camp', type: 'simple' },
        campaign_id: 99,
      } as any);

      expect(mockEventPublisher.publishWhatsappSend).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.publishWhatsappSend).toHaveBeenCalledWith(
        expect.objectContaining({
          wamid: 'wamid.OK',
          accountId: 7,
          channelId: 99,
          contactId: 42,
          messageId: 11,
          campaignId: 99,
          templateName: 'order_update',
        }),
      );
    });

    it('does NOT publish a send mapping when Meta returns no wamid', async () => {
      mockProvider.sendTemplate.mockResolvedValueOnce({ messaging_product: 'whatsapp', messages: [] });
      await service.processCampaign({
        account: { id: 7, accountConfigs: [] },
        message: { id: 11, name: 'msg', type: 'whatsapp', providerMessageId: 'order_update' },
        contacts: [{ id: 42, uuid: 'u42', hasWhatsapp: true, whatsapp: '+5511999990001' }],
        campaign: { id: 99, name: 'camp', type: 'simple' },
        campaign_id: 99,
      } as any);
      expect(mockEventPublisher.publishWhatsappSend).not.toHaveBeenCalled();
    });
  });

  describe('processAutomation', () => {
    it('skips to invalidContact path when contact has no WhatsApp', async () => {
      const next = { pubName: 'bms.triggers/trigger.process', data: { foo: 'bar' } } as any;
      const r = await service.processAutomation({
        account: { id: 7 },
        contact: { id: 1, hasWhatsapp: false },
        message: { id: 1, providerMessageId: 't' },
        messageId: 1,
        next,
      } as any);
      expect(r.status).toBe(true);
      expect(r.message).toMatch(/Invalid contact/);
      expect(mockProvider.sendTemplate).not.toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('bms.triggers', 'trigger.process', next.data);
    });

    it('returns 422 when template is missing', async () => {
      const r = await service.processAutomation({
        account: { id: 7 },
        contact: { id: 1, hasWhatsapp: true, whatsapp: '5511' },
        message: { id: 1 },
        messageId: 1,
      } as any);
      expect(r.status).toBe(422);
    });

    it('sends template and forwards to next step on success', async () => {
      const next = { pubName: 'bms.triggers/trigger.process', data: { foo: 'bar' } } as any;
      const r = await service.processAutomation({
        account: { id: 7, accountConfigs: [] },
        contact: { id: 1, hasWhatsapp: true, whatsapp: '5511' },
        message: { id: 1, providerMessageId: 'welcome', type: 'whatsapp' },
        messageId: 1,
        automationId: 5,
        next,
      } as any);
      expect(r.status).toBe(true);
      expect(mockProvider.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ templateName: 'welcome', languageCode: 'pt_BR' }));
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('bms.triggers', 'trigger.process', next.data);
      // AC1 (automation path) — wamid mapping persisted with automationId.
      expect(mockEventPublisher.publishWhatsappSend).toHaveBeenCalledWith(
        expect.objectContaining({ wamid: 'wamid.OK', accountId: 7, channelId: 99, contactId: 1, messageId: 1, automationId: 5 }),
      );
    });

    it('does NOT forward to next step when the send fails', async () => {
      mockProvider.sendTemplate.mockRejectedValueOnce(new Error('Meta returned 400 Invalid Number'));
      const next = { pubName: 'bms.triggers/trigger.process', data: { foo: 'bar' } } as any;
      const r = await service.processAutomation({
        account: { id: 7, accountConfigs: [] },
        contact: { id: 1, hasWhatsapp: true, whatsapp: '5511' },
        message: { id: 1, providerMessageId: 'welcome' },
        messageId: 1,
        next,
      } as any);
      expect(r.status).toBe(502);
      expect(mockEventPublisher.publish).not.toHaveBeenCalledWith('bms.triggers', 'trigger.process', next.data);
    });
  });

  describe('sendTracker', () => {
    it('publishes campaign.tracked with MSGOPS_SEND_BATCH_WHATSAPP service', async () => {
      const campaignMessage = {
        campaign_id: 1,
        message: { id: 10, content: 'body' },
        page: 1,
        totalPages: 1,
      } as any;

      await service.sendTracker('SENT_WHATSAPP_BATCH', campaignMessage, 5);

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'bms.campaigns',
        'campaign.tracked',
        expect.objectContaining({ service: 'MSGOPS_SEND_BATCH_WHATSAPP', event: 'SENT_WHATSAPP_BATCH', contacts_length: 5 }),
      );
    });
  });

  describe('createRedirectLink', () => {
    it('appends utm fields and delegates to msgopsService', async () => {
      const result = await service.createRedirectLink({
        url: 'https://example.com',
        utmsDefault: 'a=1',
        type: 'whatsapp',
        utmCampaign: 'camp_1',
        baseUrl: '',
        account: { id: 1 } as any,
      });
      expect(result).toBe('https://short.link/abc123');
      const [calledUrl] = mockMsgopsService.createShortLink.mock.calls[0];
      expect(calledUrl).toContain('a=1');
      expect(calledUrl).toContain('utm_source=bms');
      expect(calledUrl).toContain('utm_medium=whatsapp');
      expect(calledUrl).toContain('utm_campaign=camp_1');
    });
  });
});
