import { Test, TestingModule } from '@nestjs/testing';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';
import { FormatterUtils } from '../utils/formatter.utils';

describe('BatchController', () => {
  let controller: BatchController;
  let batchService: jest.Mocked<BatchService>;
  let formatterUtils: jest.Mocked<FormatterUtils>;

  beforeEach(async () => {
    const mockBatchService = {
      campaignBatch: jest.fn(),
      automationBatch: jest.fn(),
      getRedis: jest.fn(),
      setRedis: jest.fn(),
      setPubsubErros: jest.fn(),
    };

    const mockFormatterUtils = {
      parseBase64: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BatchController],
      providers: [
        { provide: BatchService, useValue: mockBatchService },
        { provide: FormatterUtils, useValue: mockFormatterUtils },
      ],
    }).compile();

    controller = module.get<BatchController>(BatchController);
    batchService = module.get(BatchService);
    formatterUtils = module.get(FormatterUtils);
  });

  describe('POST /batch/campaigns', () => {
    it('should process campaign batch directly', async () => {
      const batch: any = {
        campaign_id: 123,
        campaign_name: 'Test Campaign',
        contacts: [{ id: 1, email: 'test@example.com' }],
        message: { id: 1, subject: 'Test' },
      };
      const debug = 'false';
      batchService.campaignBatch.mockResolvedValue({ status: true, message: 'OK' });

      const result = await controller.campaigns(batch, { debug });

      expect(result).toEqual({ status: true, message: 'OK' });
      expect(batchService.campaignBatch).toHaveBeenCalledWith(batch, debug);
    });

    it('should parse PubSub subscription message', async () => {
      const subscriptionMessage: any = {
        subscription: 'projects/test/subscriptions/campaigns',
        message: {
          data: Buffer.from(JSON.stringify({ campaign_id: 123 })).toString('base64'),
          messageId: 'msg-123',
        },
      };
      const parsedBatch: any = { campaign_id: 123 };
      formatterUtils.parseBase64.mockReturnValue(parsedBatch);
      batchService.campaignBatch.mockResolvedValue({ status: true, message: 'OK' });

      await controller.campaigns(subscriptionMessage, { debug: 'false' });

      expect(formatterUtils.parseBase64).toHaveBeenCalledWith(subscriptionMessage.message.data);
      expect(batchService.campaignBatch).toHaveBeenCalledWith(parsedBatch, 'false');
    });

    it('should fetch from Redis when campaignKey is provided', async () => {
      const compressedPayload: any = { campaignKey: 'redis-campaign-key' };
      const redisBatch: any = { campaign_id: 456 };
      batchService.getRedis.mockResolvedValue(redisBatch);
      batchService.campaignBatch.mockResolvedValue({ status: true, message: 'OK' });

      await controller.campaigns(compressedPayload, { debug: 'false' });

      expect(batchService.getRedis).toHaveBeenCalledWith('redis-campaign-key');
      expect(batchService.campaignBatch).toHaveBeenCalledWith(redisBatch, 'false');
    });

    it('should stop processing if campaign is in STOP_CAMPAIGNS list', async () => {
      process.env.STOP_CAMPAIGNS = '100,200,300';
      const batch: any = { campaign_id: 200 };
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await controller.campaigns(batch, { debug: 'false' });

      expect(result).toEqual({});
      expect(batchService.campaignBatch).not.toHaveBeenCalled();
      consoleLogSpy.mockRestore();
      delete process.env.STOP_CAMPAIGNS;
    });

    it('should handle errors and call setPubsubErros', async () => {
      const batch: any = { campaign_id: 123 };
      batchService.campaignBatch.mockRejectedValue(new Error('Processing failed'));
      batchService.setPubsubErros.mockResolvedValue('error-id');

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await controller.campaigns(batch, { debug: 'false' });

      expect(batchService.setPubsubErros).toHaveBeenCalledWith(batch);
      expect(result).toBe('error-id');
      consoleErrorSpy.mockRestore();
    });

    it('should save to Redis on error when redisKey exists', async () => {
      const compressedPayload: any = { campaignKey: 'redis-key' };
      const redisBatch: any = { campaign_id: 456 };
      batchService.getRedis.mockResolvedValue(redisBatch);
      batchService.campaignBatch.mockRejectedValue(new Error('Processing failed'));
      batchService.setPubsubErros.mockResolvedValue('error-id');

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await controller.campaigns(compressedPayload, { debug: 'false' });

      expect(batchService.setRedis).toHaveBeenCalledWith('redis-key', redisBatch);
      expect(batchService.setPubsubErros).toHaveBeenCalledWith(compressedPayload);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('POST /batch/automations', () => {
    it('should process automation batch directly', async () => {
      const batch: any = {
        email: 'exists',
        messageId: 'msg-123',
        contacts: [{ id: 1, email: 'test@example.com' }],
        message: { id: 1, subject: 'Test' },
      };
      const debug = 'false';
      batchService.automationBatch.mockResolvedValue({ status: true, message: 'OK' });

      const result = await controller.automations(batch, { debug });

      expect(result).toEqual({ status: true, message: 'OK' });
      expect(batchService.automationBatch).toHaveBeenCalledWith(batch, debug);
    });

    it('should parse PubSub subscription message for automations', async () => {
      const subscriptionMessage: any = {
        subscription: 'projects/test/subscriptions/automations',
        message: {
          data: Buffer.from(JSON.stringify({ messageId: 'msg-123' })).toString('base64'),
          messageId: 'pub-123',
        },
      };
      const parsedBatch: any = { messageId: 'msg-123' };
      formatterUtils.parseBase64.mockReturnValue(parsedBatch);
      batchService.automationBatch.mockResolvedValue({ status: true, message: 'OK' });

      await controller.automations(subscriptionMessage, { debug: 'true' });

      expect(formatterUtils.parseBase64).toHaveBeenCalledWith(subscriptionMessage.message.data);
      expect(batchService.automationBatch).toHaveBeenCalledWith(parsedBatch, 'true');
    });
  });
});
