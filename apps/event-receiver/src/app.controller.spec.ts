import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
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

jest.mock('./event-publisher.service');

describe('AppController', () => {
  let appController: AppController;
  let eventPublisherService: jest.Mocked<EventPublisherService>;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: EventPublisherService,
          useFactory: () => ({
            publish: jest.fn().mockResolvedValue(undefined),
          }),
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    eventPublisherService = app.get(EventPublisherService);
  });

  describe('handleEvent', () => {
    const mockRequest = {
      body: {},
      query: {},
      headers: {},
      ip: '127.0.0.1',
    } as FastifyRequest;

    it('should return success response', async () => {
      const result = await appController.handleEvent(mockRequest, {});
      expect(result).toEqual({ response: 'ok' });
    });

    it('should publish message with correct data', async () => {
      await appController.handleEvent(mockRequest, {});
      expect(eventPublisherService.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
          client_info: expect.objectContaining({
            EVENT_IP: '127.0.0.1',
            ip: '127.0.0.1',
          }),
        }),
        expect.any(Object),
      );
    });
  });
});
