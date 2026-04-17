import { HttpException, HttpStatus } from '@nestjs/common';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  const mockAppService = {
    createOrUpdate: jest.fn(),
  };

  const mockFormatterUtils = {
    parsePubSubMessage: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AppController(mockAppService as any, mockFormatterUtils as any);
  });

  describe('POST / (createOrUpdate)', () => {
    it('should process a direct LeadMessage payload', async () => {
      const leadMessage = {
        apiKey: 'test-key',
        contact: { email: 'test@example.com' },
        tagName: 'test-tag',
      };
      mockAppService.createOrUpdate.mockResolvedValue({
        status: HttpStatus.OK,
        message: 'Message processed!',
      });

      const result = await controller.createOrUpdate(leadMessage as any);

      expect(mockAppService.createOrUpdate).toHaveBeenCalledWith(leadMessage);
      expect(result).toEqual({ status: HttpStatus.OK, message: 'Message processed!' });
    });

    it('should parse PubSub message format before processing', async () => {
      const pubSubPayload = {
        subscription: 'projects/test/subscriptions/lead-conception',
        message: {
          data: Buffer.from(JSON.stringify({ apiKey: 'key', contact: { email: 'a@b.com' } })).toString('base64'),
          messageId: '123',
          publishTime: '2024-01-01T00:00:00Z',
        },
      };
      const parsedMessage = { apiKey: 'key', contact: { email: 'a@b.com' } };
      mockFormatterUtils.parsePubSubMessage.mockReturnValue(parsedMessage);
      mockAppService.createOrUpdate.mockResolvedValue({
        status: HttpStatus.OK,
        message: 'processed',
      });

      const result = await controller.createOrUpdate(pubSubPayload as any);

      expect(mockFormatterUtils.parsePubSubMessage).toHaveBeenCalledWith(pubSubPayload);
      expect(mockAppService.createOrUpdate).toHaveBeenCalledWith(parsedMessage);
      expect(result.status).toBe(HttpStatus.OK);
    });

    it('should throw HttpException when result status is not OK', async () => {
      const leadMessage = {
        apiKey: 'bad-key',
        contact: { email: 'test@example.com' },
      };
      mockAppService.createOrUpdate.mockResolvedValue({
        status: HttpStatus.NOT_FOUND,
        message: 'Account not found',
      });

      await expect(controller.createOrUpdate(leadMessage as any)).rejects.toThrow(HttpException);
    });

    it('should return result when status is OK', async () => {
      const leadMessage = {
        apiKey: 'test-key',
        contact: { email: 'test@example.com' },
      };
      mockAppService.createOrUpdate.mockResolvedValue({
        status: HttpStatus.OK,
        message: 'success',
      });

      const result = await controller.createOrUpdate(leadMessage as any);

      expect(result).toEqual({ status: HttpStatus.OK, message: 'success' });
    });

    it('should handle null result from service gracefully', async () => {
      const leadMessage = {
        apiKey: 'test-key',
        contact: { email: 'test@example.com' },
      };
      mockAppService.createOrUpdate.mockResolvedValue(null);

      const result = await controller.createOrUpdate(leadMessage as any);

      expect(result).toBeNull();
    });
  });

  describe('POST /update-contact', () => {
    it('should call createOrUpdate with isUpdateContact=true for direct payload', async () => {
      const leadMessage = {
        apiKey: 'test-key',
        contact: { email: 'test@example.com', name: 'Updated' },
      };
      mockAppService.createOrUpdate.mockResolvedValue({
        status: HttpStatus.OK,
        message: 'updated',
      });

      const result = await controller.updateContact(leadMessage as any);

      expect(mockAppService.createOrUpdate).toHaveBeenCalledWith(leadMessage, true);
      expect(result.status).toBe(HttpStatus.OK);
    });

    it('should parse PubSub message for update-contact endpoint', async () => {
      const pubSubPayload = {
        subscription: 'projects/test/subscriptions/update-contact',
        message: {
          data: Buffer.from(JSON.stringify({ apiKey: 'key', contact: { email: 'a@b.com' } })).toString('base64'),
          messageId: '456',
          publishTime: '2024-01-01T00:00:00Z',
        },
      };
      const parsedMessage = { apiKey: 'key', contact: { email: 'a@b.com' } };
      mockFormatterUtils.parsePubSubMessage.mockReturnValue(parsedMessage);
      mockAppService.createOrUpdate.mockResolvedValue({
        status: HttpStatus.OK,
        message: 'updated',
      });

      await controller.updateContact(pubSubPayload as any);

      expect(mockFormatterUtils.parsePubSubMessage).toHaveBeenCalledWith(pubSubPayload);
      expect(mockAppService.createOrUpdate).toHaveBeenCalledWith(parsedMessage, true);
    });

    it('should throw HttpException when update result status is not OK', async () => {
      const leadMessage = {
        apiKey: 'test-key',
        contact: { email: 'test@example.com' },
      };
      mockAppService.createOrUpdate.mockResolvedValue({
        status: HttpStatus.UNAUTHORIZED,
        message: 'Missing apikey',
      });

      await expect(controller.updateContact(leadMessage as any)).rejects.toThrow(HttpException);
    });
  });
});
