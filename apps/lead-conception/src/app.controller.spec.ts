import { HttpException, HttpStatus } from '@nestjs/common';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  const mockAppService = {
    createOrUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AppController(mockAppService as any);
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
