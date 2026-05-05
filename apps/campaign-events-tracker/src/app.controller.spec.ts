import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FormatterUtils } from './utils/formatter.utils';
import { EventTracker, MsgopsCampaignEvent, MsgopsServices, SubscriptionMessage } from './app.interfaces';

const VALID_TOKEN = 'test-internal-token';

describe('AppController', () => {
  let controller: AppController;

  const mockAppService = {
    addEventTracker: jest.fn(),
  };

  const mockFormatterUtils = {
    parseBatch: jest.fn(),
  };

  beforeEach(async () => {
    process.env.INTERNAL_AUTH_TOKEN = VALID_TOKEN;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: AppService, useValue: mockAppService },
        { provide: FormatterUtils, useValue: mockFormatterUtils },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('addEventTracker', () => {
    const eventTracker: EventTracker = {
      campaign_id: 1,
      service: MsgopsServices.MSGOPS_CAMPAIGN_PACKER,
      event: MsgopsCampaignEvent.CAMPAIGN_PROCESSING_STARTED,
      timestamp: Date.now(),
      cloud_run: 'test',
      port: '3000',
      k_revision: 'rev1',
      k_configuration: 'config1',
      data: {},
    };

    it('rejects requests with a missing token', () => {
      expect(() => controller.addEventTracker('' as any, eventTracker, { debug: '' })).toThrow(UnauthorizedException);
      expect(mockAppService.addEventTracker).not.toHaveBeenCalled();
    });

    it('rejects requests with a wrong token', () => {
      expect(() => controller.addEventTracker('wrong-token', eventTracker, { debug: '' })).toThrow(
        UnauthorizedException,
      );
      expect(mockAppService.addEventTracker).not.toHaveBeenCalled();
    });

    it('should handle EventTracker data directly (with subscription property)', () => {
      const dataWithSubscription = { ...eventTracker, subscription: 'test-sub' } as any;
      mockFormatterUtils.parseBatch.mockReturnValue(eventTracker);
      mockAppService.addEventTracker.mockResolvedValue(eventTracker);

      controller.addEventTracker(VALID_TOKEN, dataWithSubscription, { debug: '' });

      expect(mockFormatterUtils.parseBatch).toHaveBeenCalledWith(dataWithSubscription);
      expect(mockAppService.addEventTracker).toHaveBeenCalledWith(eventTracker, '');
    });

    it('should handle EventTracker data directly (without subscription)', () => {
      mockAppService.addEventTracker.mockResolvedValue(eventTracker);

      controller.addEventTracker(VALID_TOKEN, eventTracker, { debug: '' });

      expect(mockFormatterUtils.parseBatch).not.toHaveBeenCalled();
      expect(mockAppService.addEventTracker).toHaveBeenCalledWith(eventTracker, '');
    });

    it('should pass debug query parameter', () => {
      mockAppService.addEventTracker.mockResolvedValue(eventTracker);

      controller.addEventTracker(VALID_TOKEN, eventTracker, { debug: 'true' });

      expect(mockAppService.addEventTracker).toHaveBeenCalledWith(eventTracker, 'true');
    });

    it('should handle SubscriptionMessage data', () => {
      const subscriptionMessage: SubscriptionMessage = {
        message: {
          data: Buffer.from(JSON.stringify(eventTracker)).toString('base64'),
          attributes: { key: 'test' },
          messageId: '123',
          message_id: '123',
          publishTime: new Date().toISOString(),
          publish_time: new Date().toISOString(),
        },
        subscription: 'projects/test/subscriptions/test-sub',
      };

      mockFormatterUtils.parseBatch.mockReturnValue(eventTracker);
      mockAppService.addEventTracker.mockResolvedValue(eventTracker);

      controller.addEventTracker(VALID_TOKEN, subscriptionMessage, { debug: '' });

      expect(mockFormatterUtils.parseBatch).toHaveBeenCalledWith(subscriptionMessage);
      expect(mockAppService.addEventTracker).toHaveBeenCalledWith(eventTracker, '');
    });
  });
});
