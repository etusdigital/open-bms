import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { PubSubService } from './pubsub.service';
import { FastifyRequest } from 'fastify';

describe('AppService', () => {
  let service: AppService;
  let pubSubService: jest.Mocked<PubSubService>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    const mockPubSubService = {
      sendAsyncMessage: jest.fn().mockResolvedValue(undefined),
    };

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: PubSubService,
          useValue: mockPubSubService,
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    pubSubService = module.get(PubSubService);
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
      expect(pubSubService.sendAsyncMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'web',
          timestamp: expect.any(Number),
          payload: expect.arrayContaining([
            expect.objectContaining({
              type: 'test',
              event: 'click',
              properties: { button: 'submit' },
            }),
          ]),
          client_info: expect.objectContaining({
            EVENT_FAMILY: 'test-agent',
            userAgent: 'test-agent',
          }),
        }),
        expect.objectContaining({
          platform: 'custom_events',
          events: 'click',
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
      expect(pubSubService.sendAsyncMessage).toHaveBeenCalledWith(
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

    it('should process custom events correctly', async () => {
      const customEvent = {
        type: 'custom',
        event: 'user_action',
        properties: { action: 'click' },
      };
      const mockRequest = createMockRequest(
        customEvent,
        {},
        { 'content-type': 'application/json', 'user-agent': 'test-agent' },
      );

      const result = await service.handleMessage(mockRequest, mockRequest.headers);

      expect(result).toEqual({ response: 'ok' });
      expect(pubSubService.sendAsyncMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.arrayContaining([expect.objectContaining(customEvent)]),
          client_info: expect.objectContaining({
            EVENT_FAMILY: 'test-agent',
            userAgent: 'test-agent',
          }),
        }),
        expect.objectContaining({
          platform: 'custom_events',
          events: 'user_action',
        }),
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
      expect(pubSubService.sendAsyncMessage).toHaveBeenCalledWith(
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
      expect(pubSubService.sendAsyncMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.arrayContaining([
            expect.objectContaining({
              type: 'test',
              event: 'plain_text',
              properties: { source: 'text' },
            }),
          ]),
          client_info: expect.objectContaining({
            EVENT_FAMILY: 'test-agent',
            userAgent: 'test-agent',
          }),
        }),
        expect.objectContaining({
          platform: 'custom_events',
          events: 'plain_text',
        }),
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

    it('should handle error processing custom events', async () => {
      const invalidPayload = { type: 'test', event: 'test', properties: { key: 'value' } };
      const mockRequest = createMockRequest(invalidPayload, {}, { 'content-type': 'application/json' });

      jest.spyOn(service as any, 'cleanPayload').mockImplementation(() => {
        throw new Error('test error');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await service.handleMessage(mockRequest, mockRequest.headers);

      expect(result).toEqual({ response: 'ok' });
      expect(consoleSpy).toHaveBeenCalledWith('Error processing custom events:', expect.any(Error));
      consoleSpy.mockRestore();
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
