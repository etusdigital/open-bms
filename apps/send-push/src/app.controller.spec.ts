import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseProvider } from './providers/firebase.provider';
import { PubSubProvider } from './providers/pubsub.provider';
import { RedisService } from './providers/redis/redis.service';
import { Utils } from './utils/index.utils';

const mockRedisClient = {
  exists: jest.fn(),
  getdel: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        FirebaseProvider,
        PubSubProvider,
        Utils,
        {
          provide: RedisService,
          useValue: { getClient: () => mockRedisClient },
        },
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

  describe('processRequest', () => {
    it('should parse PubSub message and process', async () => {
      const pubSubData = {
        subscription: 'test-sub',
        message: {
          data: Buffer.from(JSON.stringify({ campaignKey: '' })).toString('base64'),
          messageId: '123',
          message_id: '123',
          publishTime: '2024-01-01',
          publish_time: '2024-01-01',
          attributes: {},
        },
      };

      jest.spyOn(appService, 'getDelRedis').mockResolvedValue(null);
      jest.spyOn(appService, 'process').mockResolvedValue({ status: 201, message: 'ok' });

      await appController.processRequest(pubSubData as any);

      expect(appService.process).toHaveBeenCalled();
    });

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

  describe('receiveMessage', () => {
    it('should parse PubSub message and process single', async () => {
      const payload = {
        automationKey: '',
        automationId: 1,
        contact: { id: 1, contactDevices: [] },
        message: { id: 1 },
        account: { id: 1 },
        next: null,
      };
      const pubSubData = {
        subscription: 'test-sub',
        message: {
          data: Buffer.from(JSON.stringify(payload)).toString('base64'),
          messageId: '456',
          message_id: '456',
          publishTime: '2024-01-01',
          publish_time: '2024-01-01',
          attributes: {},
        },
      };

      jest.spyOn(appService, 'processSingle').mockResolvedValue({ status: true, message: 'ok' });

      await appController.receiveMessage(pubSubData as any);

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

      await appController.receiveMessage(data as any);

      expect(appService.getDelRedis).toHaveBeenCalledWith('auto-redis-key');
    });

    it('should return early when redis payload is null for automation', async () => {
      const data = { automationKey: 'auto-redis-missing' };

      jest.spyOn(appService, 'getDelRedis').mockResolvedValue(null);

      const result = await appController.receiveMessage(data as any);

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

      await expect(appController.receiveMessage(data as any)).rejects.toThrow('single error');
    });
  });
});
