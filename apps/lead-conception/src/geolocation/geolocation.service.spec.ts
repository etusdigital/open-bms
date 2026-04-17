import { GeolocationService } from './geolocation.service';
import { of } from 'rxjs';

describe('GeolocationService', () => {
  let service: GeolocationService;

  const mockLocationResponse = {
    country: 'BR',
    region: 'SP',
    city: 'Sao Paulo',
    postalCode: '01000',
    timezone: 'America/Sao_Paulo',
    latitude: -23.5,
    longitude: -46.6,
    success: true,
  };

  const mockGeoService = {
    getLocation: jest.fn().mockReturnValue(of(mockLocationResponse)),
  };

  const mockClientGrpc = {
    getService: jest.fn().mockReturnValue(mockGeoService),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GeolocationService(mockClientGrpc as any);
  });

  describe('onModuleInit', () => {
    it('should initialize the gRPC geolocation service client', () => {
      service.onModuleInit();

      expect(mockClientGrpc.getService).toHaveBeenCalledWith('GeoIpService');
    });
  });

  describe('getLocationObservable', () => {
    it('should return an observable of LocationResponse', (done) => {
      service.onModuleInit();

      const result$ = service.getLocationObservable('192.168.1.1');

      result$.subscribe((result) => {
        expect(result).toEqual(mockLocationResponse);
        expect(mockGeoService.getLocation).toHaveBeenCalledWith({ ip: '192.168.1.1' });
        done();
      });
    });
  });

  describe('getLocation', () => {
    it('should return a promise of LocationResponse', async () => {
      service.onModuleInit();

      const result = await service.getLocation('10.0.0.1');

      expect(result).toEqual(mockLocationResponse);
      expect(mockGeoService.getLocation).toHaveBeenCalledWith({ ip: '10.0.0.1' });
    });
  });
});
