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

describe('AppService', () => {
  let service: AppService;

  const mockEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockMsgopsService = {
    createShortLink: jest.fn().mockResolvedValue('https://short.link/abc123'),
  };

  const mockUtils = {};

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

  describe('processCampaign — Wave 2 stub', () => {
    it('returns 503 without invoking any provider (WhatsApp Cloud lands in Wave 5)', async () => {
      const result = await service.processCampaign({
        account: { id: 7, name: 'Acme', accountConfigs: [] } as any,
        message: { id: 1, name: 'msg', type: 'whatsapp', content: '' } as any,
        contacts: [],
      } as any);

      expect(result).toEqual({ status: 503, message: expect.stringMatching(/Wave 5/) });
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe('processAutomation — Wave 2 stub', () => {
    it('returns 503 and forwards to next step when next.pubName is set', async () => {
      const next = { pubName: 'bms.triggers/trigger.process', data: { foo: 'bar' } } as any;

      const result = await service.processAutomation({
        account: { id: 7, accountConfigs: [] } as any,
        contact: { id: 1, hasWhatsapp: true, whatsapp: '+55119...' } as any,
        message: { id: 1, type: 'whatsapp' } as any,
        next,
      } as any);

      expect(result.status).toBe(503);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('bms.triggers', 'trigger.process', next.data);
    });

    it('redirects to invalidContact path when contact has no WhatsApp', async () => {
      const next = { pubName: 'bms.triggers/trigger.process', data: { foo: 'bar' } } as any;

      const result = await service.processAutomation({
        account: { id: 7 } as any,
        contact: { id: 1, hasWhatsapp: false } as any,
        message: { id: 1 } as any,
        messageId: 1,
        next,
      } as any);

      expect(result.status).toBe(true);
      expect(result.message).toMatch(/Invalid contact/);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('bms.triggers', 'trigger.process', next.data);
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
      expect(mockMsgopsService.createShortLink).toHaveBeenCalled();
      const [calledUrl] = mockMsgopsService.createShortLink.mock.calls[0];
      expect(calledUrl).toContain('a=1');
      expect(calledUrl).toContain('utm_source=bms');
      expect(calledUrl).toContain('utm_medium=whatsapp');
      expect(calledUrl).toContain('utm_campaign=camp_1');
    });
  });
});
