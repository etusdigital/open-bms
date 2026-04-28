import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Utils } from './utils/index.utils';

describe('AppController', () => {
  let appController: AppController;

  const VALID_TOKEN = 'dev-send-whatsapp-token-test';

  const mockAppService = {
    getHello: jest.fn().mockReturnValue('Hello World!'),
    processCampaign: jest.fn().mockResolvedValue({ status: 201, message: 'ok' }),
    processAutomation: jest.fn().mockResolvedValue({ status: true, message: 'sent' }),
  };

  beforeEach(async () => {
    process.env.INTERNAL_AUTH_TOKEN = VALID_TOKEN;

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

  describe('processCampaign (TODO Onda 4)', () => {
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
  });

  describe('processAutomation (/internal/whatsapp/automation)', () => {
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

    it('should reject with 401 when token is missing', async () => {
      await expect(appController.processAutomation('', automationPayload as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should reject with 401 when token mismatches', async () => {
      await expect(appController.processAutomation('wrong-token', automationPayload as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should process automation when token is valid', async () => {
      const result = await appController.processAutomation(VALID_TOKEN, automationPayload as any);
      expect(mockAppService.processAutomation).toHaveBeenCalledWith(automationPayload);
      expect(result).toEqual({ status: true, message: 'sent' });
    });

    it('should throw when appService.processAutomation throws', async () => {
      mockAppService.processAutomation.mockRejectedValueOnce(new Error('Evolution API down'));

      await expect(appController.processAutomation(VALID_TOKEN, automationPayload as any)).rejects.toThrow('Evolution API down');
    });
  });
});
