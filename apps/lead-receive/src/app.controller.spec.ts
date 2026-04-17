import { HttpException, HttpStatus } from '@nestjs/common';
import { AppController } from './app.controller';
import { createLeadMessage, createQuizPayload, createContactWithDevice } from './__mocks__/test-fixtures';

describe('AppController', () => {
  let controller: AppController;
  let mockAppService: any;
  let mockUtils: any;

  beforeEach(() => {
    mockAppService = {
      process: jest.fn().mockResolvedValue({ status: 200, message: 'Published' }),
      updateContact: jest.fn().mockResolvedValue({ status: 200, message: 'Published' }),
      parsePayloadQuiz: jest.fn(),
    };
    mockUtils = {
      getRawBody: jest.fn().mockResolvedValue(null),
      logInfo: jest.fn(),
    };
    controller = new AppController(mockAppService, mockUtils);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('updateContact', () => {
    const createMockRequest = (overrides: any = {}) => ({
      readable: false,
      headers: { 'user-agent': 'test-agent' },
      ...overrides,
    });

    it('should call appService.updateContact with the lead message', async () => {
      const message = createLeadMessage();
      const request = createMockRequest();

      await controller.updateContact(message, request);

      expect(mockAppService.updateContact).toHaveBeenCalled();
    });

    it('should set IP address when contact has no ip', async () => {
      const message = createLeadMessage();
      const request = createMockRequest();

      await controller.updateContact(message, request, '192.168.1.1');

      const calledWith = mockAppService.updateContact.mock.calls[0][0];
      expect(calledWith.contact.ip).toBe('192.168.1.1');
    });

    it('should not override existing IP address', async () => {
      const message = createLeadMessage({
        contact: { email: 'test@test.com', firstName: 'John', ip: '10.0.0.1' },
      });
      const request = createMockRequest();

      await controller.updateContact(message, request, '192.168.1.1');

      const calledWith = mockAppService.updateContact.mock.calls[0][0];
      expect(calledWith.contact.ip).toBe('10.0.0.1');
    });

    it('should set user_agent from request headers', async () => {
      const message = createLeadMessage();
      const request = createMockRequest({
        headers: { 'user-agent': 'Mozilla/5.0' },
      });

      await controller.updateContact(message, request);

      const calledWith = mockAppService.updateContact.mock.calls[0][0];
      expect(calledWith.user_agent).toBe('Mozilla/5.0');
    });

    it('should not override existing user_agent', async () => {
      const message = createLeadMessage({ user_agent: 'custom-agent' });
      const request = createMockRequest();

      await controller.updateContact(message, request);

      const calledWith = mockAppService.updateContact.mock.calls[0][0];
      expect(calledWith.user_agent).toBe('custom-agent');
    });

    it('should use raw body when request is readable', async () => {
      const rawMessage = createLeadMessage({ apiKey: 'raw-key' });
      mockUtils.getRawBody.mockResolvedValue(rawMessage);
      const request = createMockRequest({ readable: true });

      await controller.updateContact(createLeadMessage(), request);

      const calledWith = mockAppService.updateContact.mock.calls[0][0];
      expect(calledWith.apiKey).toBe('raw-key');
    });

    it('should keep original body when getRawBody returns null', async () => {
      mockUtils.getRawBody.mockResolvedValue(null);
      const message = createLeadMessage({ apiKey: 'original-key' });
      const request = createMockRequest({ readable: true });

      await controller.updateContact(message, request);

      const calledWith = mockAppService.updateContact.mock.calls[0][0];
      expect(calledWith.apiKey).toBe('original-key');
    });

    it('should call logInfo with update contact payload', async () => {
      const message = createLeadMessage();
      const request = createMockRequest();

      await controller.updateContact(message, request);

      expect(mockUtils.logInfo).toHaveBeenCalledWith('update contact payload', expect.any(Object));
    });

    it('should rethrow errors from appService', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      mockAppService.updateContact.mockRejectedValue(new HttpException('Error', HttpStatus.FORBIDDEN));
      const message = createLeadMessage();
      const request = createMockRequest();

      await expect(controller.updateContact(message, request)).rejects.toThrow(HttpException);
    });
  });

  describe('process', () => {
    const createMockRequest = (overrides: any = {}) => ({
      readable: false,
      headers: { 'user-agent': 'test-agent' },
      ...overrides,
    });

    const createMockResponse = () => {
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      return res;
    };

    it('should process a valid lead message', async () => {
      const message = createLeadMessage();
      const request = createMockRequest();
      const response = createMockResponse();

      await controller.process(message, request, response, '1.2.3.4');

      expect(mockAppService.process).toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    });

    it('should return 400 when contact is empty', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const message = createLeadMessage({
        contact: {} as any,
      });
      const request = createMockRequest();
      const response = createMockResponse();

      await controller.process(message, request, response);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Empty contact' }));
    });

    it('should return 400 when contact is missing', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const message = { apiKey: 'key', tagName: 'tag' } as any;
      const request = createMockRequest();
      const response = createMockResponse();

      await controller.process(message, request, response);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when apiKey is missing', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const message = {
        contact: { email: 'test@test.com', firstName: 'John' },
        tagName: 'tag',
      } as any;
      const request = createMockRequest();
      const response = createMockResponse();

      await controller.process(message, request, response);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'No API key' }));
    });

    it('should return 400 for invalid email (missing @)', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const message = createLeadMessage({
        contact: { email: 'invalidemail', firstName: 'John' },
      });
      const request = createMockRequest();
      const response = createMockResponse();

      await controller.process(message, request, response);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Invalid Payload Email') }),
      );
    });

    it('should return 422 when firstName is too long', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const message = createLeadMessage({
        contact: { email: 'test@test.com', firstName: 'A'.repeat(101) },
      });
      const request = createMockRequest();
      const response = createMockResponse();

      await controller.process(message, request, response);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('should return 422 when contact.name is too long', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const message = createLeadMessage({
        contact: { email: 'test@test.com', firstName: 'John', name: 'A'.repeat(101) },
      });
      const request = createMockRequest();
      const response = createMockResponse();

      await controller.process(message, request, response);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('should set IP on contact when not present', async () => {
      const message = createLeadMessage();
      const request = createMockRequest();
      const response = createMockResponse();

      await controller.process(message, request, response, '5.6.7.8');

      const calledWith = mockAppService.process.mock.calls[0][0];
      expect(calledWith.contact.ip).toBe('5.6.7.8');
    });

    it('should set user_agent from request headers', async () => {
      const message = createLeadMessage();
      const request = createMockRequest({ headers: { 'user-agent': 'Chrome/100' } });
      const response = createMockResponse();

      await controller.process(message, request, response);

      const calledWith = mockAppService.process.mock.calls[0][0];
      expect(calledWith.user_agent).toBe('Chrome/100');
    });

    it('should set device IP when device has no IP', async () => {
      const message = createLeadMessage({
        contact: createContactWithDevice(),
      });
      const request = createMockRequest();
      const response = createMockResponse();

      await controller.process(message, request, response, '9.8.7.6');

      const calledWith = mockAppService.process.mock.calls[0][0];
      expect(calledWith.contact.devices![0].ip).toBe('9.8.7.6');
    });

    it('should call parsePayloadQuiz for quiz payloads without contact', async () => {
      const quizPayload = { app: 'plusdin-quiz-cc', email: 'test@test.com' } as any;
      const parsedMessage = createLeadMessage();
      mockAppService.parsePayloadQuiz.mockResolvedValue(parsedMessage);
      const request = createMockRequest();
      const response = createMockResponse();

      await controller.process(quizPayload, request, response);

      expect(mockAppService.parsePayloadQuiz).toHaveBeenCalled();
    });

    it('should use raw body when request is readable', async () => {
      const rawMessage = createLeadMessage({ apiKey: 'raw-api-key' });
      mockUtils.getRawBody.mockResolvedValue(rawMessage);
      const request = createMockRequest({ readable: true });
      const response = createMockResponse();

      await controller.process(createLeadMessage(), request, response);

      const calledWith = mockAppService.process.mock.calls[0][0];
      expect(calledWith.apiKey).toBe('raw-api-key');
    });

    it('should rethrow errors', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      mockAppService.process.mockRejectedValue(new Error('Unexpected'));
      const message = createLeadMessage();
      const request = createMockRequest();
      const response = createMockResponse();

      await expect(controller.process(message, request, response)).rejects.toThrow('Unexpected');
    });

    it('should allow valid email addresses through', async () => {
      const message = createLeadMessage({
        contact: { email: 'valid@test.com', firstName: 'John' },
      });
      const request = createMockRequest();
      const response = createMockResponse();

      await controller.process(message, request, response);

      expect(mockAppService.process).toHaveBeenCalled();
    });
  });
});
