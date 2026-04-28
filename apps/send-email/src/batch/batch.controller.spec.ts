import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';

const VALID_TOKEN = 'dev-send-email-token-change-me-please';

describe('BatchController', () => {
  let controller: BatchController;
  let batchService: jest.Mocked<BatchService>;

  beforeEach(async () => {
    process.env.INTERNAL_AUTH_TOKEN = VALID_TOKEN;
    const mockBatchService = {
      campaignBatch: jest.fn(),
      automationBatch: jest.fn(),
      getRedis: jest.fn(),
      setRedis: jest.fn(),
      publishCampaignError: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BatchController],
      providers: [{ provide: BatchService, useValue: mockBatchService }],
    }).compile();

    controller = module.get<BatchController>(BatchController);
    batchService = module.get(BatchService);
  });

  describe('POST /internal/campaigns/send', () => {
    it('should reject when token is wrong', async () => {
      const batch: any = { campaign_id: 123 };
      await expect(controller.campaigns('bad-token', batch, { debug: 'false' })).rejects.toThrow(UnauthorizedException);
    });

    it('should process campaign batch with valid token', async () => {
      const batch: any = {
        campaign_id: 123,
        campaign_name: 'Test Campaign',
        contacts: [{ id: 1, email: 'test@example.com' }],
        message: { id: 1, subject: 'Test' },
      };
      const debug = 'false';
      batchService.campaignBatch.mockResolvedValue({ status: true, message: 'OK' } as any);

      const result = await controller.campaigns(VALID_TOKEN, batch, { debug });

      expect(result).toEqual({ status: true, message: 'OK' });
      expect(batchService.campaignBatch).toHaveBeenCalledWith(batch, debug);
    });

    it('should fetch from Redis when campaignKey is provided', async () => {
      const compressedPayload: any = { campaignKey: 'redis-campaign-key' };
      const redisBatch: any = { campaign_id: 456 };
      batchService.getRedis.mockResolvedValue(redisBatch);
      batchService.campaignBatch.mockResolvedValue({ status: true, message: 'OK' } as any);

      await controller.campaigns(VALID_TOKEN, compressedPayload, { debug: 'false' });

      expect(batchService.getRedis).toHaveBeenCalledWith('redis-campaign-key');
      expect(batchService.campaignBatch).toHaveBeenCalledWith(redisBatch, 'false');
    });

    it('should stop processing if campaign is in STOP_CAMPAIGNS list', async () => {
      process.env.STOP_CAMPAIGNS = '100,200,300';
      const batch: any = { campaign_id: 200 };
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await controller.campaigns(VALID_TOKEN, batch, { debug: 'false' });

      expect(result).toEqual({});
      expect(batchService.campaignBatch).not.toHaveBeenCalled();
      consoleLogSpy.mockRestore();
      delete process.env.STOP_CAMPAIGNS;
    });

    it('should handle errors and call publishCampaignError', async () => {
      const batch: any = { campaign_id: 123 };
      batchService.campaignBatch.mockRejectedValue(new Error('Processing failed'));
      batchService.publishCampaignError.mockResolvedValue('error-id' as any);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await controller.campaigns(VALID_TOKEN, batch, { debug: 'false' });

      expect(batchService.publishCampaignError).toHaveBeenCalledWith(batch);
      expect(result).toBe('error-id');
      consoleErrorSpy.mockRestore();
    });

    it('should save to Redis on error when redisKey exists', async () => {
      const compressedPayload: any = { campaignKey: 'redis-key' };
      const redisBatch: any = { campaign_id: 456 };
      batchService.getRedis.mockResolvedValue(redisBatch);
      batchService.campaignBatch.mockRejectedValue(new Error('Processing failed'));
      batchService.publishCampaignError.mockResolvedValue('error-id' as any);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await controller.campaigns(VALID_TOKEN, compressedPayload, { debug: 'false' });

      expect(batchService.setRedis).toHaveBeenCalledWith('redis-key', redisBatch);
      expect(batchService.publishCampaignError).toHaveBeenCalledWith(compressedPayload);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('POST /internal/automations/process', () => {
    it('should reject when token is wrong', async () => {
      const batch: any = { messageId: 'msg-123' };
      await expect(controller.automations('bad-token', batch, { debug: 'false' })).rejects.toThrow(UnauthorizedException);
    });

    it('should process automation batch with valid token', async () => {
      const batch: any = {
        email: 'exists',
        messageId: 'msg-123',
        contacts: [{ id: 1, email: 'test@example.com' }],
        message: { id: 1, subject: 'Test' },
      };
      const debug = 'false';
      batchService.automationBatch.mockResolvedValue({ status: true, message: 'OK' } as any);

      const result = await controller.automations(VALID_TOKEN, batch, { debug });

      expect(result).toEqual({ status: true, message: 'OK' });
      expect(batchService.automationBatch).toHaveBeenCalledWith(batch, debug);
    });
  });
});
