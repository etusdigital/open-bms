import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;
  let appService: Partial<Record<keyof AppService, jest.Mock>>;

  beforeEach(async () => {
    appService = {
      validate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appService }],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  describe('validate()', () => {
    it('should call AppService.validate with email, apiKey, and shouldChargeUse=true', async () => {
      appService.validate.mockResolvedValue({ result: 'deliverable' });

      await controller.validate('user@example.com', 'test-key');

      expect(appService.validate).toHaveBeenCalledWith('user@example.com', 'test-key', true);
    });

    it('should return the validation result', async () => {
      const expected = { result: 'deliverable', email: 'user@example.com' };
      appService.validate.mockResolvedValue(expected);

      const result = await controller.validate('user@example.com', 'test-key');

      expect(result).toEqual(expected);
    });
  });

  describe('oldCommon()', () => {
    it('should call AppService.validate with shouldChargeUse=false', async () => {
      appService.validate.mockResolvedValue({ result: 'deliverable' });

      await controller.oldCommon('user@example.com');

      expect(appService.validate).toHaveBeenCalledWith('user@example.com', '', false);
    });

    it('should return the validation result', async () => {
      const expected = { result: 'deliverable' };
      appService.validate.mockResolvedValue(expected);

      const result = await controller.oldCommon('user@example.com');

      expect(result).toEqual(expected);
    });
  });
});
