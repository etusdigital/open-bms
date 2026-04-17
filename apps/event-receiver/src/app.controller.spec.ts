import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PubSubService } from './pubsub.service';
import { FastifyRequest } from 'fastify';

jest.mock('./pubsub.service');

describe('AppController', () => {
  let appController: AppController;
  let pubSubService: jest.Mocked<PubSubService>;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PubSubService,
          useFactory: () => ({
            sendAsyncMessage: jest.fn().mockResolvedValue(undefined),
          }),
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    pubSubService = app.get(PubSubService);
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

    it('should send message to PubSub with correct data', async () => {
      await appController.handleEvent(mockRequest, {});
      expect(pubSubService.sendAsyncMessage).toHaveBeenCalledWith(
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
