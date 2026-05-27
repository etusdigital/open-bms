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
import { UnauthorizedException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventPublisherService } from './event-publisher.service';
import { FirebaseProvider } from './providers/firebase.provider';
import { RedisService } from './providers/redis/redis.service';
import { Utils } from './utils/index.utils';

const mockRedisClient = {
  exists: jest.fn(),
  getdel: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockEventPublisher = {
  publish: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
};

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  const VALID_TOKEN = 'dev-send-push-token-test';

  beforeEach(async () => {
    process.env.INTERNAL_AUTH_TOKEN = VALID_TOKEN;
    process.env.AMQP_URL = 'amqp://test';

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        FirebaseProvider,
        Utils,
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: RedisService, useValue: { getClient: () => mockRedisClient } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('processRequest (campaign — TODO Onda 4)', () => {
    it('should handle compressed campaign payload from redis', async () => {
      const data = { campaignKey: 'redis-key-1' };
      const campaignData = {
        account: { id: 1, accountConfigs: [] },
        campaign: { id: 1, name: 'test' },
        contacts: [],
        message: { id: 1 },
        page: 1,
        totalPages: 1,
        campaign_id: 1,
      };

      jest.spyOn(appService, 'getDelRedis').mockResolvedValue(campaignData);
      jest.spyOn(appService, 'process').mockResolvedValue({ status: 201, message: 'ok' });

      await appController.processRequest(data as any);

      expect(appService.getDelRedis).toHaveBeenCalledWith('redis-key-1');
      expect(appService.process).toHaveBeenCalled();
    });

    it('should return early when redis payload is null', async () => {
      const data = { campaignKey: 'redis-key-missing' };

      jest.spyOn(appService, 'getDelRedis').mockResolvedValue(null);

      const result = await appController.processRequest(data as any);

      expect(result).toBeUndefined();
    });

    it('should re-set redis key on error and rethrow', async () => {
      const data = { campaignKey: 'redis-key-err' };
      const campaignData = {
        account: { id: 1, accountConfigs: [] },
        campaign: { id: 1, name: 'test' },
        contacts: [],
        message: { id: 1 },
        page: 1,
        totalPages: 1,
        campaign_id: 1,
      };

      jest.spyOn(appService, 'getDelRedis').mockResolvedValue(campaignData);
      jest.spyOn(appService, 'process').mockRejectedValue(new Error('process error'));
      jest.spyOn(appService, 'setRedis').mockResolvedValue('OK');

      await expect(appController.processRequest(data as any)).rejects.toThrow('process error');
      expect(appService.setRedis).toHaveBeenCalledWith('redis-key-err', campaignData, 43200);
    });
  });

  describe('receiveMessage (/internal/push/single)', () => {
    it('should reject with 401 when token is missing', async () => {
      await expect(appController.receiveMessage('', {} as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should reject with 401 when token mismatches', async () => {
      await expect(appController.receiveMessage('wrong-token', {} as any)).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });

    it('should process direct payload when token is valid', async () => {
      const payload = {
        automationKey: '',
        automationId: 1,
        contact: { id: 1, contactDevices: [] },
        message: { id: 1 },
        account: { id: 1 },
        next: null,
      };

      jest.spyOn(appService, 'processSingle').mockResolvedValue({ status: true, message: 'ok' });

      await appController.receiveMessage(VALID_TOKEN, payload as any);

      expect(appService.processSingle).toHaveBeenCalled();
    });

    it('should handle compressed automation payload from redis', async () => {
      const data = { automationKey: 'auto-redis-key' };
      const automationData = {
        automationId: 1,
        contact: { id: 1, contactDevices: [] },
        message: { id: 1 },
        account: { id: 1 },
        next: null,
      };

      jest.spyOn(appService, 'getDelRedis').mockResolvedValue(automationData);
      jest.spyOn(appService, 'processSingle').mockResolvedValue({ status: true, message: 'ok' });

      await appController.receiveMessage(VALID_TOKEN, data as any);

      expect(appService.getDelRedis).toHaveBeenCalledWith('auto-redis-key');
    });

    it('should return early when redis payload is null for automation', async () => {
      const data = { automationKey: 'auto-redis-missing' };

      jest.spyOn(appService, 'getDelRedis').mockResolvedValue(null);

      const result = await appController.receiveMessage(VALID_TOKEN, data as any);

      expect(result).toBeUndefined();
    });

    it('should throw HttpException on processSingle error', async () => {
      const data = {
        automationId: 1,
        contact: { id: 1, contactDevices: [] },
        message: { id: 1, type: 'web-push' },
        account: { id: 1, accountConfigs: [] },
        next: null,
        automationKey: '',
      };

      jest.spyOn(appService, 'processSingle').mockRejectedValue(new Error('single error'));

      await expect(appController.receiveMessage(VALID_TOKEN, data as any)).rejects.toThrow('single error');
    });
  });
});
