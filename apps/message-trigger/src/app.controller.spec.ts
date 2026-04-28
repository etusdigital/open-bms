import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ResultDto } from './dtos/result.dto';
import { CompressedPayload } from './interfaces';
import { createMockLeadStateMessage, createMockCompressedPayload } from './__mocks__/test-fixtures';

describe('AppController', () => {
  let controller: AppController;
  let appService: jest.Mocked<AppService>;

  beforeEach(async () => {
    const mockAppService = {
      getState: jest.fn(),
      processHttpRequest: jest.fn(),
      receiveMessage: jest.fn(),
      getRedis: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: mockAppService }],
    }).compile();

    controller = module.get<AppController>(AppController);
    appService = module.get(AppService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET / (getState)', () => {
    it('should return state from appService', async () => {
      const expectedResult: ResultDto = { status: true, message: 'Service is running' };
      appService.getState.mockResolvedValue(expectedResult);

      const result = await controller.getState();

      expect(result).toEqual(expectedResult);
      expect(appService.getState).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from appService.getState', async () => {
      appService.getState.mockRejectedValue(new Error('Service unavailable'));
      await expect(controller.getState()).rejects.toThrow('Service unavailable');
    });
  });

  describe('POST /http-request (processHttpRequest)', () => {
    const mockLeadStateMessage = createMockLeadStateMessage();

    it('should call appService.processHttpRequest with LeadStateMessage', async () => {
      appService.processHttpRequest.mockResolvedValue(undefined);

      const result = await controller.processHttpRequest(mockLeadStateMessage);

      expect(appService.processHttpRequest).toHaveBeenCalledWith(mockLeadStateMessage);
      expect(result).toBeUndefined();
    });

    it('should log and rethrow errors', async () => {
      const error = new Error('Processing failed');
      appService.processHttpRequest.mockRejectedValue(error);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(controller.processHttpRequest(mockLeadStateMessage)).rejects.toThrow('Processing failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('POST / (receiveMessage)', () => {
    const mockLeadStateMessage = createMockLeadStateMessage();
    const expectedResult: ResultDto = { status: true, message: 'Message received' };

    describe('With CompressedPayload (has automationKey)', () => {
      it('should retrieve data from Redis and process message', async () => {
        const compressedPayload = createMockCompressedPayload({
          automationKey: 'automation-50-123-1234567890',
          contactId: 123,
          automationId: 50,
          stepId: 100,
        });

        appService.getRedis.mockResolvedValue(mockLeadStateMessage);
        appService.receiveMessage.mockResolvedValue(expectedResult);

        const result = await controller.receiveMessage(compressedPayload);

        expect(appService.getRedis).toHaveBeenCalledWith('automation-50-123-1234567890');
        expect(appService.receiveMessage).toHaveBeenCalledWith(mockLeadStateMessage, 'http', 'automation-50-123-1234567890');
        expect(result).toEqual(expectedResult);
      });

      it('should handle empty automationKey — treat as plain LeadStateMessage', async () => {
        const compressedPayload: CompressedPayload = {
          automationKey: '',
          contactId: 123,
          automationId: 50,
          stepId: 100,
        };

        appService.receiveMessage.mockResolvedValue(expectedResult);

        const result = await controller.receiveMessage(compressedPayload);

        expect(appService.getRedis).not.toHaveBeenCalled();
        expect(appService.receiveMessage).toHaveBeenCalledWith(compressedPayload as any, 'http', '');
        expect(result).toEqual(expectedResult);
      });
    });

    describe('With LeadStateMessage (direct input)', () => {
      it('should process message directly without Redis lookup', async () => {
        appService.receiveMessage.mockResolvedValue(expectedResult);

        const result = await controller.receiveMessage(mockLeadStateMessage);

        expect(appService.getRedis).not.toHaveBeenCalled();
        expect(appService.receiveMessage).toHaveBeenCalledWith(mockLeadStateMessage, 'http', '');
        expect(result).toEqual(expectedResult);
      });
    });

    describe('Error handling', () => {
      it('should log and rethrow errors from Redis retrieval', async () => {
        const compressedPayload = createMockCompressedPayload();
        const redisError = new Error('Redis connection failed');
        appService.getRedis.mockRejectedValue(redisError);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        await expect(controller.receiveMessage(compressedPayload)).rejects.toThrow('Redis connection failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith(redisError);
        consoleErrorSpy.mockRestore();
      });

      it('should log and rethrow errors from appService.receiveMessage', async () => {
        const error = new Error('Message processing failed');
        appService.receiveMessage.mockRejectedValue(error);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        await expect(controller.receiveMessage(mockLeadStateMessage)).rejects.toThrow('Message processing failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith(error);
        consoleErrorSpy.mockRestore();
      });
    });

    describe('Edge cases', () => {
      it('should handle data without automationKey gracefully', async () => {
        const dataWithoutKey: any = { contactId: 123, automationId: 50, stepId: 100 };
        appService.receiveMessage.mockResolvedValue(expectedResult);

        const result = await controller.receiveMessage(dataWithoutKey);

        expect(appService.getRedis).not.toHaveBeenCalled();
        expect(appService.receiveMessage).toHaveBeenCalledWith(dataWithoutKey, 'http', '');
        expect(result).toEqual(expectedResult);
      });
    });
  });
});
