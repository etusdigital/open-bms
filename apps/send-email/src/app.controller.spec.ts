import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ResultDto } from './dtos/result.dto';

const VALID_TOKEN = 'dev-send-email-token-change-me-please';

describe('AppController', () => {
  let controller: AppController;
  let appService: jest.Mocked<AppService>;

  beforeEach(async () => {
    process.env.INTERNAL_AUTH_TOKEN = VALID_TOKEN;
    const mockAppService = {
      getState: jest.fn(),
      getRedis: jest.fn(),
      receiveMessage: jest.fn(),
      sendToNextStep: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: mockAppService }],
    }).compile();

    controller = module.get<AppController>(AppController);
    appService = module.get(AppService);
  });

  describe('GET /', () => {
    it('should return state from appService', async () => {
      const expectedResult: ResultDto = { status: true, message: 'Ok!' };
      appService.getState.mockResolvedValue(expectedResult);

      const result = await controller.getState();

      expect(result).toEqual(expectedResult);
      expect(appService.getState).toHaveBeenCalled();
    });
  });

  describe('POST /internal/email/send', () => {
    it('should reject when token is missing', async () => {
      const sendEmailMessage: any = { messageId: 'msg-123' };
      await expect(controller.receiveMessage(undefined as any, sendEmailMessage)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject when token is wrong', async () => {
      const sendEmailMessage: any = { messageId: 'msg-123' };
      await expect(controller.receiveMessage('wrong-token', sendEmailMessage)).rejects.toThrow(UnauthorizedException);
    });

    it('should process SendEmailMessage with valid token', async () => {
      const sendEmailMessage: any = {
        messageId: 'msg-123',
        contact: { id: 1, email: 'test@example.com' },
        message: { id: 1, subject: 'Test' },
      };
      const expectedResult: ResultDto = { status: true, message: 'OK' };
      appService.receiveMessage.mockResolvedValue(expectedResult);

      const result = await controller.receiveMessage(VALID_TOKEN, sendEmailMessage);

      expect(result).toEqual(expectedResult);
      expect(appService.receiveMessage).toHaveBeenCalledWith(sendEmailMessage, '');
    });

    it('should fetch from Redis when automationKey is provided', async () => {
      const compressedPayload: any = { automationKey: 'redis-key-123' };
      const redisData: any = { messageId: 'msg-from-redis' };
      appService.getRedis.mockResolvedValue(redisData);
      appService.receiveMessage.mockResolvedValue({ status: true, message: 'OK' });

      await controller.receiveMessage(VALID_TOKEN, compressedPayload);

      expect(appService.getRedis).toHaveBeenCalledWith('redis-key-123');
      expect(appService.receiveMessage).toHaveBeenCalledWith(redisData, 'redis-key-123');
    });

    it('should throw HttpException on error', async () => {
      const sendEmailMessage: any = { messageId: 'msg-123' };
      appService.receiveMessage.mockRejectedValue(new Error('Processing failed'));

      await expect(controller.receiveMessage(VALID_TOKEN, sendEmailMessage)).rejects.toThrow(HttpException);
    });

    it('should handle Invalid URL error gracefully', async () => {
      const sendEmailMessage: any = { messageId: 'msg-123', next: { data: { id: 'lead-123' } } };
      appService.receiveMessage.mockRejectedValue(new Error('Invalid URL'));
      appService.sendToNextStep.mockResolvedValue(undefined);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await controller.receiveMessage(VALID_TOKEN, sendEmailMessage);

      expect(appService.sendToNextStep).toHaveBeenCalledWith(sendEmailMessage.next.data, '');
      consoleLogSpy.mockRestore();
    });
  });
});
