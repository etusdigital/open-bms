import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ResultDto } from './dtos/result.dto';

describe('AppController', () => {
  let controller: AppController;
  let appService: jest.Mocked<AppService>;

  beforeEach(async () => {
    const mockAppService = {
      getState: jest.fn(),
      parseNewMessageDtoToSendMailMessage: jest.fn(),
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

  describe('POST / - receiveMessage', () => {
    it('should process SendEmailMessage directly', async () => {
      const sendEmailMessage: any = {
        messageId: 'msg-123',
        contact: { id: 1, email: 'test@example.com' },
        message: { id: 1, subject: 'Test' },
      };
      const expectedResult: ResultDto = { status: true, message: 'OK' };
      appService.receiveMessage.mockResolvedValue(expectedResult);

      const result = await controller.receiveMessage(sendEmailMessage);

      expect(result).toEqual(expectedResult);
      expect(appService.receiveMessage).toHaveBeenCalledWith(sendEmailMessage, '');
    });

    it('should parse PubSub message format', async () => {
      const pubsubMessage: any = {
        subscription: 'projects/test/subscriptions/test-sub',
        message: {
          data: Buffer.from(JSON.stringify({ messageId: 'msg-123' })).toString('base64'),
          messageId: 'pub-123',
        },
      };
      const parsedMessage: any = { messageId: 'msg-123' };
      appService.parseNewMessageDtoToSendMailMessage.mockReturnValue(parsedMessage);
      appService.receiveMessage.mockResolvedValue({ status: true, message: 'OK' });

      await controller.receiveMessage(pubsubMessage);

      expect(appService.parseNewMessageDtoToSendMailMessage).toHaveBeenCalledWith(pubsubMessage);
      expect(appService.receiveMessage).toHaveBeenCalledWith(parsedMessage, '');
    });

    it('should fetch from Redis when automationKey is provided', async () => {
      const compressedPayload: any = { automationKey: 'redis-key-123' };
      const redisData: any = { messageId: 'msg-from-redis' };
      appService.getRedis.mockResolvedValue(redisData);
      appService.receiveMessage.mockResolvedValue({ status: true, message: 'OK' });

      await controller.receiveMessage(compressedPayload);

      expect(appService.getRedis).toHaveBeenCalledWith('redis-key-123');
      expect(appService.receiveMessage).toHaveBeenCalledWith(redisData, 'redis-key-123');
    });

    it('should throw HttpException on error', async () => {
      const sendEmailMessage: any = { messageId: 'msg-123' };
      appService.receiveMessage.mockRejectedValue(new Error('Processing failed'));

      await expect(controller.receiveMessage(sendEmailMessage)).rejects.toThrow(HttpException);
    });

    it('should handle Invalid URL error gracefully', async () => {
      const pubsubMessage: any = {
        subscription: 'projects/test/subscriptions/test-sub',
        message: { data: 'invalid-base64', messageId: 'pub-123' },
      };
      const parsedMessage: any = { next: { data: { id: 'lead-123' } } };
      appService.parseNewMessageDtoToSendMailMessage.mockReturnValue(parsedMessage);
      appService.receiveMessage.mockRejectedValue(new Error('Invalid URL'));
      appService.sendToNextStep.mockResolvedValue(undefined);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await controller.receiveMessage(pubsubMessage);

      expect(appService.sendToNextStep).toHaveBeenCalledWith(parsedMessage.next.data, {});
      consoleLogSpy.mockRestore();
    });
  });
});
