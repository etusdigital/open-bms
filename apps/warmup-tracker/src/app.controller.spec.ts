import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NotifyPayload } from './interfaces';

describe('AppController', () => {
  let appController: AppController;
  let appService: jest.Mocked<AppService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getHello: jest.fn(),
            notify: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = module.get<AppController>(AppController);
    appService = module.get(AppService);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });

  describe('getHello', () => {
    it('should return the result from appService.getHello', () => {
      appService.getHello.mockReturnValue('Hello World!');
      expect(appController.getHello()).toBe('Hello World!');
    });

    it('should call appService.getHello', () => {
      appService.getHello.mockReturnValue('test');
      appController.getHello();
      expect(appService.getHello).toHaveBeenCalled();
    });
  });

  describe('notify', () => {
    const payload: NotifyPayload = {
      warmup: 1,
      message: {
        id: 1,
        subject: 'Test',
        email: 'test@test.com',
        name: 'Test',
      },
      recipients: [{ name: 'User', email: 'user@test.com' }],
    };

    it('should call appService.notify with the request body', async () => {
      appService.notify.mockResolvedValue({ ok: true });
      await appController.notify(payload);
      expect(appService.notify).toHaveBeenCalledWith(payload);
    });

    it('should return the result from appService.notify', async () => {
      appService.notify.mockResolvedValue({ ok: true });
      const result = await appController.notify(payload);
      expect(result).toEqual({ ok: true });
    });

    it('should propagate errors from appService.notify', async () => {
      appService.notify.mockRejectedValue(new NotFoundException('No internal users found'));
      await expect(appController.notify(payload)).rejects.toThrow(NotFoundException);
    });

    it('should handle null data being passed through', async () => {
      appService.notify.mockResolvedValue(undefined);
      const result = await appController.notify(null as any);
      expect(result).toBeUndefined();
    });
  });
});
