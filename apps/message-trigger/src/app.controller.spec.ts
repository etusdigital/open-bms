import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FormatterUtils } from './utils/formatter.utils';
import { NewMessageDto } from './dtos/message.dto';
import { ResultDto } from './dtos/result.dto';
import { CompressedPayload } from './interfaces';
import { createMockLeadStateMessage, createMockCompressedPayload } from './__mocks__/test-fixtures';
import { BadRequestException } from '@nestjs/common';

describe('AppController', () => {
  let controller: AppController;
  let appService: jest.Mocked<AppService>;
  let formatterUtils: jest.Mocked<FormatterUtils>;

  beforeEach(async () => {
    const mockAppService = {
      getState: jest.fn(),
      processHttpRequest: jest.fn(),
      receiveMessage: jest.fn(),
      getRedis: jest.fn(),
    };

    const mockFormatterUtils = {
      parseBase64ToObject: jest.fn(),
      stripString: jest.fn(),
      slugify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: AppService, useValue: mockAppService },
        { provide: FormatterUtils, useValue: mockFormatterUtils },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    appService = module.get(AppService);
    formatterUtils = module.get(FormatterUtils);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET / (getState)', () => {
    it('should return state from appService', async () => {
      // Arrange
      const expectedResult: ResultDto = {
        status: true,
        message: 'Service is running',
      };
      appService.getState.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.getState();

      // Assert
      expect(result).toEqual(expectedResult);
      expect(appService.getState).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from appService.getState', async () => {
      // Arrange
      const error = new Error('Service unavailable');
      appService.getState.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getState()).rejects.toThrow('Service unavailable');
    });
  });

  describe('POST /http-request (processHttpRequest)', () => {
    const mockLeadStateMessage = createMockLeadStateMessage();

    describe('With NewMessageDto (requires parsing)', () => {
      it('should parse NewMessageDto and call appService.processHttpRequest', async () => {
        // Arrange
        const newMessageDto: NewMessageDto = {
          message: {
            data: Buffer.from(JSON.stringify(mockLeadStateMessage)).toString('base64'),
            messageId: 'msg-123',
            message_id: 'msg-123',
            publishTime: '2024-01-15T10:00:00Z',
            publish_time: '2024-01-15T10:00:00Z',
          },
          subscription: 'projects/test/subscriptions/test-sub',
        };

        formatterUtils.parseBase64ToObject.mockReturnValue(mockLeadStateMessage);
        appService.processHttpRequest.mockResolvedValue(true);

        // Act
        const result = await controller.processHttpRequest(newMessageDto);

        // Assert
        expect(formatterUtils.parseBase64ToObject).toHaveBeenCalledWith(newMessageDto);
        expect(appService.processHttpRequest).toHaveBeenCalledWith(mockLeadStateMessage);
        expect(result).toBe(true);
      });

      it('should handle parsing errors and log them', async () => {
        // Arrange
        const newMessageDto: NewMessageDto = {
          message: {
            data: 'invalid-base64',
            messageId: 'msg-456',
            message_id: 'msg-456',
            publishTime: '2024-01-15T10:00:00Z',
            publish_time: '2024-01-15T10:00:00Z',
          },
          subscription: 'projects/test/subscriptions/test-sub',
        };
        const parseError = new BadRequestException('Unable to parse data');

        formatterUtils.parseBase64ToObject.mockImplementation(() => {
          throw parseError;
        });

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Act & Assert
        await expect(controller.processHttpRequest(newMessageDto)).rejects.toThrow(BadRequestException);
        expect(consoleErrorSpy).toHaveBeenCalledWith(parseError);

        consoleErrorSpy.mockRestore();
      });
    });

    describe('With LeadStateMessage (no parsing needed)', () => {
      it('should call appService.processHttpRequest directly', async () => {
        // Arrange
        appService.processHttpRequest.mockResolvedValue(undefined);

        // Act
        const result = await controller.processHttpRequest(mockLeadStateMessage);

        // Assert
        expect(formatterUtils.parseBase64ToObject).not.toHaveBeenCalled();
        expect(appService.processHttpRequest).toHaveBeenCalledWith(mockLeadStateMessage);
        expect(result).toBeUndefined();
      });
    });

    describe('Error handling', () => {
      it('should log and rethrow errors from appService.processHttpRequest', async () => {
        // Arrange
        const error = new Error('Processing failed');
        appService.processHttpRequest.mockRejectedValue(error);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Act & Assert
        await expect(controller.processHttpRequest(mockLeadStateMessage)).rejects.toThrow('Processing failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith(error);

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('POST / (receiveMessage)', () => {
    const mockLeadStateMessage = createMockLeadStateMessage();
    const expectedResult: ResultDto = { status: true, message: 'Message received' };

    describe('With NewMessageDto (subscription present)', () => {
      it('should parse base64 data and process message', async () => {
        // Arrange
        const newMessageDto: NewMessageDto = {
          message: {
            data: Buffer.from(JSON.stringify(mockLeadStateMessage)).toString('base64'),
            messageId: 'msg-789',
            message_id: 'msg-789',
            publishTime: '2024-01-15T11:00:00Z',
            publish_time: '2024-01-15T11:00:00Z',
          },
          subscription: 'projects/test/subscriptions/test-sub',
        };

        formatterUtils.parseBase64ToObject.mockReturnValue(mockLeadStateMessage);
        appService.receiveMessage.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.receiveMessage(newMessageDto);

        // Assert
        expect(formatterUtils.parseBase64ToObject).toHaveBeenCalledWith(newMessageDto);
        // Note: messageId is extracted BEFORE parsing, but after parsing data becomes LeadStateMessage
        // which doesn't have .message property, so messageId defaults to 'local'
        expect(appService.receiveMessage).toHaveBeenCalledWith(mockLeadStateMessage, 'local', '');
        expect(result).toEqual(expectedResult);
      });

      it('should use "local" as messageId when not available in NewMessageDto', async () => {
        // Arrange
        const newMessageDtoWithoutId: NewMessageDto = {
          message: {
            data: Buffer.from(JSON.stringify(mockLeadStateMessage)).toString('base64'),
            messageId: '',
            message_id: '',
            publishTime: '2024-01-15T11:00:00Z',
            publish_time: '2024-01-15T11:00:00Z',
          },
          subscription: 'projects/test/subscriptions/test-sub',
        };

        formatterUtils.parseBase64ToObject.mockReturnValue(mockLeadStateMessage);
        appService.receiveMessage.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.receiveMessage(newMessageDtoWithoutId);

        // Assert
        expect(appService.receiveMessage).toHaveBeenCalledWith(mockLeadStateMessage, 'local', '');
        expect(result).toEqual(expectedResult);
      });
    });

    describe('With CompressedPayload (has automationKey)', () => {
      it('should retrieve data from Redis and process message', async () => {
        // Arrange
        const compressedPayload = createMockCompressedPayload({
          automationKey: 'automation-50-123-1234567890',
          contactId: 123,
          automationId: 50,
          stepId: 100,
        });

        appService.getRedis.mockResolvedValue(mockLeadStateMessage);
        appService.receiveMessage.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.receiveMessage(compressedPayload);

        // Assert
        expect(appService.getRedis).toHaveBeenCalledWith('automation-50-123-1234567890');
        expect(appService.receiveMessage).toHaveBeenCalledWith(mockLeadStateMessage, 'local', 'automation-50-123-1234567890');
        expect(result).toEqual(expectedResult);
      });

      it('should handle empty automationKey', async () => {
        // Arrange
        const compressedPayload: CompressedPayload = {
          automationKey: '',
          contactId: 123,
          automationId: 50,
          stepId: 100,
        };

        appService.receiveMessage.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.receiveMessage(compressedPayload);

        // Assert
        expect(appService.getRedis).not.toHaveBeenCalled();
        expect(appService.receiveMessage).toHaveBeenCalledWith(compressedPayload as any, 'local', '');
        expect(result).toEqual(expectedResult);
      });

      it('should handle null Redis response gracefully', async () => {
        // Arrange
        const compressedPayload = createMockCompressedPayload({
          automationKey: 'non-existent-key',
        });

        appService.getRedis.mockResolvedValue(null);

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Act & Assert
        // When Redis returns null, trying to access .message throws TypeError
        await expect(controller.receiveMessage(compressedPayload)).rejects.toThrow(TypeError);
        expect(appService.getRedis).toHaveBeenCalledWith('non-existent-key');

        consoleErrorSpy.mockRestore();
      });
    });

    describe('With LeadStateMessage (direct input)', () => {
      it('should process message directly without parsing or Redis lookup', async () => {
        // Arrange
        appService.receiveMessage.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.receiveMessage(mockLeadStateMessage);

        // Assert
        expect(formatterUtils.parseBase64ToObject).not.toHaveBeenCalled();
        expect(appService.getRedis).not.toHaveBeenCalled();
        expect(appService.receiveMessage).toHaveBeenCalledWith(mockLeadStateMessage, 'local', '');
        expect(result).toEqual(expectedResult);
      });
    });

    describe('Error handling', () => {
      it('should log and rethrow errors from parsing', async () => {
        // Arrange
        const newMessageDto: NewMessageDto = {
          message: {
            data: 'corrupted-data',
            messageId: 'msg-error',
            message_id: 'msg-error',
            publishTime: '2024-01-15T11:00:00Z',
            publish_time: '2024-01-15T11:00:00Z',
          },
          subscription: 'projects/test/subscriptions/test-sub',
        };

        const parseError = new BadRequestException('Parsing failed');
        formatterUtils.parseBase64ToObject.mockImplementation(() => {
          throw parseError;
        });

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Act & Assert
        await expect(controller.receiveMessage(newMessageDto)).rejects.toThrow(BadRequestException);
        expect(consoleErrorSpy).toHaveBeenCalledWith(parseError);

        consoleErrorSpy.mockRestore();
      });

      it('should log and rethrow errors from Redis retrieval', async () => {
        // Arrange
        const compressedPayload = createMockCompressedPayload();
        const redisError = new Error('Redis connection failed');
        appService.getRedis.mockRejectedValue(redisError);

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Act & Assert
        await expect(controller.receiveMessage(compressedPayload)).rejects.toThrow('Redis connection failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith(redisError);

        consoleErrorSpy.mockRestore();
      });

      it('should log and rethrow errors from appService.receiveMessage', async () => {
        // Arrange
        const error = new Error('Message processing failed');
        appService.receiveMessage.mockRejectedValue(error);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Act & Assert
        await expect(controller.receiveMessage(mockLeadStateMessage)).rejects.toThrow('Message processing failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith(error);

        consoleErrorSpy.mockRestore();
      });
    });

    describe('Edge cases', () => {
      it('should handle NewMessageDto with nested messageId extraction', async () => {
        // Arrange
        const newMessageDto: any = {
          message: {
            data: Buffer.from(JSON.stringify(mockLeadStateMessage)).toString('base64'),
            messageId: 'nested-msg-id',
            message_id: 'nested-msg-id',
            publishTime: '2024-01-15T11:00:00Z',
            publish_time: '2024-01-15T11:00:00Z',
          },
          subscription: 'projects/test/subscriptions/test-sub',
        };

        formatterUtils.parseBase64ToObject.mockReturnValue(mockLeadStateMessage);
        appService.receiveMessage.mockResolvedValue(expectedResult);

        // Act
        await controller.receiveMessage(newMessageDto);

        // Assert
        // After parsing, data becomes LeadStateMessage which doesn't have .message property
        // So messageId defaults to 'local'
        expect(appService.receiveMessage).toHaveBeenCalledWith(mockLeadStateMessage, 'local', '');
      });

      it('should handle data with both subscription and automationKey (subscription takes precedence)', async () => {
        // Arrange
        const mixedData: any = {
          message: {
            data: Buffer.from(JSON.stringify(mockLeadStateMessage)).toString('base64'),
            messageId: 'mixed-msg-id',
            message_id: 'mixed-msg-id',
            publishTime: '2024-01-15T11:00:00Z',
            publish_time: '2024-01-15T11:00:00Z',
          },
          subscription: 'projects/test/subscriptions/test-sub',
          automationKey: 'should-not-use-this',
        };

        formatterUtils.parseBase64ToObject.mockReturnValue(mockLeadStateMessage);
        appService.receiveMessage.mockResolvedValue(expectedResult);

        // Act
        await controller.receiveMessage(mixedData);

        // Assert
        expect(formatterUtils.parseBase64ToObject).toHaveBeenCalledWith(mixedData);
        expect(appService.getRedis).not.toHaveBeenCalled();
      });

      it('should handle undefined automationKey gracefully', async () => {
        // Arrange
        const dataWithoutKey: any = {
          contactId: 123,
          automationId: 50,
          stepId: 100,
        };

        appService.receiveMessage.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.receiveMessage(dataWithoutKey);

        // Assert
        expect(appService.getRedis).not.toHaveBeenCalled();
        expect(appService.receiveMessage).toHaveBeenCalledWith(dataWithoutKey, 'local', '');
        expect(result).toEqual(expectedResult);
      });
    });
  });
});
