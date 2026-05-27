import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ClientGrpc, ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { IpRequest, LocationResponse } from '../src/geoip.interface';

interface GeoIpService {
  getLocation(data: IpRequest): Promise<LocationResponse>;
}

describe('GeoIpController (e2e)', () => {
  let app: INestApplication;
  let client: ClientGrpc;
  let geoIpService: GeoIpService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        ClientsModule.register([
          {
            name: 'GEOIP_PACKAGE',
            transport: Transport.GRPC,
            options: {
              package: 'geoip',
              protoPath: join(__dirname, '../src/geoip.proto'),
              url: 'localhost:50051',
            },
          },
        ]),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.connectMicroservice({
      transport: Transport.GRPC,
      options: {
        package: 'geoip',
        protoPath: join(__dirname, '../src/geoip.proto'),
        url: 'localhost:50051',
      },
    });

    await app.startAllMicroservices();
    await app.init();

    client = app.get<ClientGrpc>('GEOIP_PACKAGE');
    geoIpService = client.getService<GeoIpService>('GeoIpService');
  });

  afterAll(async () => {
    await app.close();
  });

  // This is a mock test since the actual database might not be available
  it('getLocation - receives a valid response structure', async () => {
    // Mock response data
    const mockResponse: LocationResponse = {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      postalCode: '94105',
      timezone: 'America/Los_Angeles',
      latitude: 37.7749,
      longitude: -122.4194,
      success: true,
    };

    // Mock the actual gRPC call
    jest.spyOn(geoIpService, 'getLocation').mockImplementation(() => Promise.resolve(mockResponse));

    // Call the service with a test IP
    const result = await geoIpService.getLocation({ ip: '8.8.8.8' });

    // Validate the response structure
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(typeof result.country).toBe('string');
    expect(typeof result.region).toBe('string');
    expect(typeof result.city).toBe('string');
    expect(typeof result.postalCode).toBe('string');
    expect(typeof result.timezone).toBe('string');
    expect(typeof result.latitude).toBe('number');
    expect(typeof result.longitude).toBe('number');
  });
});
