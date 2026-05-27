import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LocationResponse } from './geoip.interface';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getLocation: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('getLocation', () => {
    it('should return location data for valid IP', () => {
      const mockLocation: LocationResponse = {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        postalCode: '94105',
        timezone: 'America/Los_Angeles',
        latitude: 37.7749,
        longitude: -122.4194,
        success: true,
      };

      jest.spyOn(appService, 'getLocation').mockReturnValue(mockLocation);

      const result = appController.getLocation({ ip: '8.8.8.8' });

      expect(appService.getLocation).toHaveBeenCalledWith('8.8.8.8');
      expect(result).toEqual(mockLocation);
    });

    it('should pass the ip field from IpRequest to AppService', () => {
      const errorResponse: LocationResponse = {
        country: '',
        region: '',
        city: '',
        postalCode: '',
        timezone: '',
        latitude: 0,
        longitude: 0,
        success: false,
        error: 'Database not loaded',
      };

      jest.spyOn(appService, 'getLocation').mockReturnValue(errorResponse);

      appController.getLocation({ ip: '1.2.3.4' });
      expect(appService.getLocation).toHaveBeenCalledWith('1.2.3.4');
    });

    it('should return error response when service returns failure', () => {
      const errorResponse: LocationResponse = {
        country: '',
        region: '',
        city: '',
        postalCode: '',
        timezone: '',
        latitude: 0,
        longitude: 0,
        success: false,
        error: 'Invalid IP address format',
      };
      jest.spyOn(appService, 'getLocation').mockReturnValue(errorResponse);

      const result = appController.getLocation({ ip: 'bad-ip' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid IP address format');
    });

    it('should return database not loaded error when service has no db', () => {
      const dbError: LocationResponse = {
        country: '',
        region: '',
        city: '',
        postalCode: '',
        timezone: '',
        latitude: 0,
        longitude: 0,
        success: false,
        error: 'Database not loaded',
      };
      jest.spyOn(appService, 'getLocation').mockReturnValue(dbError);

      const result = appController.getLocation({ ip: '8.8.8.8' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not loaded');
    });
  });
});
