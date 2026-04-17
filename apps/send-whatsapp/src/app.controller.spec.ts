import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Utils } from './utils/index.utils';
import { PubSubMessage } from './interfaces';

describe('AppController', () => {
  let appController: AppController;

  const mockAppService = {
    getHello: jest.fn().mockReturnValue('Hello World!'),
    processCampaign: jest.fn().mockResolvedValue({ status: 201, message: 'ok' }),
    processAutomation: jest.fn().mockResolvedValue({ status: true, message: 'sent' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: mockAppService }, Utils],
    }).compile();

    appController = module.get<AppController>(AppController);

    jest.clearAllMocks();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
      expect(mockAppService.getHello).toHaveBeenCalled();
    });
  });

  describe('processCampaign', () => {
    const campaignPayload = {
      account: {
        id: 1,
        name: 'Test Account',
        accountConfigs: [
          { accountId: 1, name: 'whatsapp_number_id', value: 'inst-1', description: null },
          { accountId: 1, name: 'whatsapp_access_token', value: 'token-1', description: null },
        ],
      },
      campaign_id: 100,
      campaign_name: 'test-campaign',
      contacts: [{ id: 1, uuid: 'uuid-1', whatsapp: '+5511999999999', token: 't' }],
      message: { id: 1, accountId: 1, title: 'Test', name: 'test', content: 'Hello', type: 'whatsapp' },
    };

    it('should process a direct campaign payload', async () => {
      const result = await appController.processCampaign(campaignPayload as any);
      expect(mockAppService.processCampaign).toHaveBeenCalledWith(campaignPayload);
      expect(result).toEqual({ status: 201, message: 'ok' });
    });

    it('should decode a PubSub-wrapped campaign payload', async () => {
      const pubSubMessage: PubSubMessage = {
        subscription: 'projects/test/subscriptions/test-sub',
        message: {
          data: Buffer.from(JSON.stringify(campaignPayload)).toString('base64'),
          messageId: 'msg-1',
          message_id: 'msg-1',
          publishTime: new Date().toISOString(),
          publish_time: new Date().toISOString(),
          attributes: {},
        },
      };

      await appController.processCampaign(pubSubMessage);
      expect(mockAppService.processCampaign).toHaveBeenCalledWith(campaignPayload);
    });

    it('should throw on invalid PubSub data', async () => {
      const pubSubMessage: PubSubMessage = {
        subscription: 'projects/test/subscriptions/test-sub',
        message: {
          data: 'not-valid-base64!!!',
          messageId: 'msg-2',
          message_id: 'msg-2',
          publishTime: new Date().toISOString(),
          publish_time: new Date().toISOString(),
          attributes: {},
        },
      };

      await expect(appController.processCampaign(pubSubMessage)).rejects.toThrow();
    });
  });

  describe('processAutomation', () => {
    const automationPayload = {
      startedAt: Date.now(),
      automationId: 1,
      automationName: 'Test Auto',
      automationType: 'email' as const,
      utmContent: 'bms',
      utmCampaign: 'test-e1-01',
      next: { pubName: 'topic', data: {} },
      messageId: 'msg-auto-1',
      message: { id: 1, accountId: 1, title: 'Test', name: 'test', content: 'Hello', type: 'whatsapp' },
      contact: { id: 1, uuid: 'uuid-1', whatsapp: '+5511999999999', hasWhatsapp: true, token: 't' },
      account: {
        id: 1,
        name: 'Test Account',
        accountConfigs: [
          { accountId: 1, name: 'whatsapp_number_id', value: 'inst-1', description: null },
          { accountId: 1, name: 'whatsapp_access_token', value: 'token-1', description: null },
        ],
      },
    };

    it('should process a direct automation payload', async () => {
      const result = await appController.processAutomation(automationPayload as any);
      expect(mockAppService.processAutomation).toHaveBeenCalledWith(automationPayload);
      expect(result).toEqual({ status: true, message: 'sent' });
    });

    it('should decode a PubSub-wrapped automation payload', async () => {
      const pubSubMessage: PubSubMessage = {
        subscription: 'projects/test/subscriptions/test-sub',
        message: {
          data: Buffer.from(JSON.stringify(automationPayload)).toString('base64'),
          messageId: 'msg-3',
          message_id: 'msg-3',
          publishTime: new Date().toISOString(),
          publish_time: new Date().toISOString(),
          attributes: {},
        },
      };

      await appController.processAutomation(pubSubMessage);
      expect(mockAppService.processAutomation).toHaveBeenCalledWith(automationPayload);
    });

    it('should throw when appService.processAutomation throws', async () => {
      mockAppService.processAutomation.mockRejectedValueOnce(new Error('Evolution API down'));

      await expect(appController.processAutomation(automationPayload as any)).rejects.toThrow('Evolution API down');
    });
  });
});
