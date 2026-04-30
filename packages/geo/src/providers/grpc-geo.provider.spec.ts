import { GrpcGeoProvider } from './grpc-geo.provider';
import { of, throwError } from 'rxjs';

const mockGetLocation = jest.fn();
const mockGrpcClient = {
  getService: jest.fn().mockReturnValue({ getLocation: mockGetLocation }),
};

describe('GrpcGeoProvider', () => {
  let provider: GrpcGeoProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GrpcGeoProvider(mockGrpcClient as any);
    provider.onModuleInit();
  });

  it('returns mapped GeoData on successful lookup', async () => {
    mockGetLocation.mockReturnValue(
      of({
        success: true,
        country: 'US',
        region: 'CA',
        city: 'Mountain View',
        traits: { asn: 15169, asnOrg: 'Google LLC', isp: '', organization: '', userType: 'hosting', connectionType: '', isAnycast: false },
      }),
    );

    const result = await provider.lookup('8.8.8.8');
    expect(result).toMatchObject({ country: 'US', region: 'CA', city: 'Mountain View' });
    expect(result?.traits?.asn).toBe(15169);
  });

  it('returns null when success is false', async () => {
    mockGetLocation.mockReturnValue(of({ success: false, error: 'not found' }));
    expect(await provider.lookup('127.0.0.1')).toBeNull();
  });

  it('returns null when Observable errors', async () => {
    mockGetLocation.mockReturnValue(throwError(() => new Error('gRPC connection refused')));
    expect(await provider.lookup('8.8.8.8')).toBeNull();
  });
});
