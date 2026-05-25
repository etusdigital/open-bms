import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { EventPublisherService } from './event-publisher.service';
import { FastifyRequest } from 'fastify';

jest.mock('@bms/messaging', () => ({
  AmqpPublisher: jest.fn().mockImplementation(() => ({
    publish: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  EXCHANGES: { events: 'bms.events' },
}));

describe('AppService', () => {
  let service: AppService;
  let eventPublisherService: jest.Mocked<EventPublisherService>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    const mockEventPublisherService = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: EventPublisherService,
          useValue: mockEventPublisherService,
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    eventPublisherService = module.get(EventPublisherService);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const createMockRequest = (body: any = {}, query: any = {}, headers: any = {}, ip = '127.0.0.1'): FastifyRequest => {
    return {
      body,
      query,
      headers,
      ip,
    } as FastifyRequest;
  };

  describe('handleMessage', () => {
    it('should process JSON payload correctly', async () => {
      const mockRequest = createMockRequest(
        { type: 'test', event: 'click', properties: { button: 'submit' } },
        { source: 'web' },
        { 'content-type': 'application/json', 'user-agent': 'test-agent' },
      );

      const result = await service.handleMessage(mockRequest, mockRequest.headers);

      expect(result).toEqual({ response: 'ok' });
      expect(eventPublisherService.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'web',
          timestamp: expect.any(Number),
          payload: expect.objectContaining({
            type: 'test',
            event: 'click',
            properties: { button: 'submit' },
          }),
          client_info: expect.objectContaining({
            EVENT_FAMILY: 'test-agent',
            userAgent: 'test-agent',
          }),
        }),
        expect.objectContaining({
          source: 'web',
        }),
      );
    });

    it('should handle empty JSON body', async () => {
      const mockRequest = createMockRequest({}, {}, { 'content-type': 'application/json' });

      const result = await service.handleMessage(mockRequest, mockRequest.headers);

      expect(result).toEqual({
        statusCode: 422,
        response: 'Empty body',
      });
    });

    it('should process form-urlencoded payload correctly', async () => {
      const formData = 'type=test&event=submit&value=123';
      const mockRequest = createMockRequest(formData, {}, { 'content-type': 'application/x-www-form-urlencoded' });

      const result = await service.handleMessage(mockRequest, mockRequest.headers);

      expect(result).toEqual({ response: 'ok' });
      expect(eventPublisherService.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            type: 'test',
            event: 'submit',
            value: '123',
          },
        }),
        expect.any(Object),
      );
    });

    it('should process Twilio events correctly', async () => {
      const mockRequest = createMockRequest(
        { MessageStatus: 'delivered' },
        { platform: 'twilio', message_type: 'sms' },
        { 'content-type': 'application/json' },
      );

      const result = await service.handleMessage(mockRequest, mockRequest.headers);

      expect(result).toEqual({ response: 'ok' });
      expect(eventPublisherService.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            MessageStatus: 'delivered',
            event: 'delivered',
          },
          categories: expect.objectContaining({
            platform: 'twilio',
            message_type: 'sms',
          }),
        }),
        expect.objectContaining({
          platform: 'twilio',
          event: 'delivered',
        }),
      );
    });

    it('should handle text/plain JSON payload correctly', async () => {
      const jsonString = JSON.stringify({
        type: 'test',
        event: 'plain_text',
        properties: { source: 'text' },
      });
      const mockRequest = createMockRequest(
        jsonString,
        {},
        { 'content-type': 'text/plain', 'user-agent': 'test-agent' },
      );

      const result = await service.handleMessage(mockRequest, mockRequest.headers);

      expect(result).toEqual({ response: 'ok' });
      expect(eventPublisherService.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            type: 'test',
            event: 'plain_text',
            properties: { source: 'text' },
          }),
          client_info: expect.objectContaining({
            EVENT_FAMILY: 'test-agent',
            userAgent: 'test-agent',
          }),
        }),
        expect.any(Object),
      );
    });

    it('should handle invalid text/plain JSON payload', async () => {
      const invalidJson = 'invalid json';
      const mockRequest = createMockRequest(invalidJson, {}, { 'content-type': 'text/plain' });

      const result = await service.handleMessage(mockRequest, mockRequest.headers);

      expect(result).toEqual({
        statusCode: 422,
        response: 'Invalid JSON',
      });
    });

    it('should handle empty form-urlencoded body', async () => {
      const mockRequest = createMockRequest('', {}, { 'content-type': 'application/x-www-form-urlencoded' });

      const result = await service.handleMessage(mockRequest, mockRequest.headers);

      expect(result).toEqual({
        statusCode: 422,
        response: 'Empty body',
      });
    });
  });
});
