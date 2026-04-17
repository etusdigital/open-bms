import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { GeoIpLookupResult } from './geoip.interface';

// Mock fs
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue(Buffer.from('test')),
}));

// Mock the mmdb-reader module
// We store the lookup mock on the constructor function so we can access it
const mockLookup = jest.fn();
jest.mock('mmdb-reader', () => {
  // SWC handles `import * as X` differently: it expects { default: ... }
  const ctor = jest.fn().mockImplementation(() => ({ lookup: mockLookup }));
  return { __esModule: true, default: ctor };
});

describe('AppService', () => {
  let service: AppService;

  const originalEnv = process.env;

  beforeEach(async () => {
    // Set environment variable for the test
    process.env = { ...originalEnv, DBIP_MMDB_PATH: './mock-path.mmdb' };

    // Reset mocks before each test
    mockLookup.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('getLocation', () => {
    it('should return successful location data for valid IP', () => {
      const mockResult: GeoIpLookupResult = {
        country: { iso_code: 'US' },
        subdivisions: [{ iso_code: 'CA' }],
        city: { names: { en: 'San Francisco' } },
        postal: { code: '94105' },
        location: {
          time_zone: 'America/Los_Angeles',
          latitude: '37.7749',
          longitude: '-122.4194',
        },
      };

      mockLookup.mockReturnValue(mockResult);

      const result = service.getLocation('8.8.8.8');

      expect(mockLookup).toHaveBeenCalledWith('8.8.8.8');
      expect(result).toEqual({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        postalCode: '94105',
        timezone: 'America/Los_Angeles',
        latitude: 37.7749,
        longitude: -122.4194,
        success: true,
      });
    });

    it('should handle missing fields from the lookup result', () => {
      const mockResult: GeoIpLookupResult = {
        country: { iso_code: 'US' },
      };

      mockLookup.mockReturnValue(mockResult);

      const result = service.getLocation('8.8.8.8');

      expect(result).toEqual({
        country: 'US',
        region: '',
        city: '',
        postalCode: '',
        timezone: '',
        latitude: 0,
        longitude: 0,
        success: true,
      });
    });

    it('should handle completely empty lookup result', () => {
      mockLookup.mockReturnValue({});

      const result = service.getLocation('192.168.1.1');

      expect(result).toEqual({
        country: '',
        region: '',
        city: '',
        postalCode: '',
        timezone: '',
        latitude: 0,
        longitude: 0,
        success: true,
      });
    });

    it('should handle null lookup result', () => {
      mockLookup.mockReturnValue(null);

      const result = service.getLocation('8.8.8.8');

      expect(result).toEqual({
        country: '',
        region: '',
        city: '',
        postalCode: '',
        timezone: '',
        latitude: 0,
        longitude: 0,
        success: true,
      });
    });

    it('should handle errors during lookup', () => {
      mockLookup.mockImplementation(() => {
        throw new Error('Lookup error');
      });

      const result = service.getLocation('8.8.8.8');

      expect(result).toEqual({
        country: '',
        region: '',
        city: '',
        postalCode: '',
        timezone: '',
        latitude: 0,
        longitude: 0,
        success: false,
        error: 'Failed to lookup IP: Lookup error',
      });
    });

    it('should handle non-Error thrown during lookup', () => {
      mockLookup.mockImplementation(() => {
        throw 'string error';
      });

      const result = service.getLocation('8.8.8.8');

      expect(result).toEqual({
        country: '',
        region: '',
        city: '',
        postalCode: '',
        timezone: '',
        latitude: 0,
        longitude: 0,
        success: false,
        error: 'Failed to lookup IP: Unknown error',
      });
    });

    it('should return error for invalid IP address', () => {
      const result = service.getLocation('invalid-ip');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid IP address format');
      expect(mockLookup).not.toHaveBeenCalled();
    });

    it('should return error when database is not loaded', () => {
      (service as any).mmdbReader = null;

      const result = service.getLocation('8.8.8.8');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not loaded');
    });

    it('should return error when ip is empty string', () => {
      const result = service.getLocation('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not loaded');
    });
  });

  describe('isValidIp (real implementation)', () => {
    it('should return true for valid IPv4 addresses', () => {
      expect((service as any).isValidIp('8.8.8.8')).toBe(true);
      expect((service as any).isValidIp('192.168.1.1')).toBe(true);
      expect((service as any).isValidIp('127.0.0.1')).toBe(true);
      expect((service as any).isValidIp('0.0.0.0')).toBe(true);
      expect((service as any).isValidIp('255.255.255.255')).toBe(true);
      expect((service as any).isValidIp('10.0.0.1')).toBe(true);
    });

    it('should return true for valid IPv6 addresses', () => {
      expect((service as any).isValidIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
      expect((service as any).isValidIp('::1')).toBe(true);
      expect((service as any).isValidIp('2001:db8::1')).toBe(true);
      expect((service as any).isValidIp('fe80::1')).toBe(true);
    });

    it('should return false for invalid IP addresses', () => {
      expect((service as any).isValidIp('256.256.256.256')).toBe(false);
      expect((service as any).isValidIp('not-an-ip')).toBe(false);
      expect((service as any).isValidIp('')).toBe(false);
      expect((service as any).isValidIp('999.0.0.1')).toBe(false);
      expect((service as any).isValidIp('::gggg')).toBe(false);
      expect((service as any).isValidIp('abc')).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should set mmdbReader to null when DBIP_MMDB_PATH is not set', async () => {
      process.env = { ...originalEnv };
      delete process.env.DBIP_MMDB_PATH;

      const module = await Test.createTestingModule({
        providers: [AppService],
      }).compile();

      const svc = module.get<AppService>(AppService);
      expect((svc as any).mmdbReader).toBeNull();
    });

    it('should set mmdbReader to null when readFileSync throws', async () => {
      const fs = require('fs');
      fs.readFileSync.mockImplementationOnce(() => {
        throw new Error('file not found');
      });

      process.env = { ...originalEnv, DBIP_MMDB_PATH: './missing.mmdb' };

      const module = await Test.createTestingModule({
        providers: [AppService],
      }).compile();

      const svc = module.get<AppService>(AppService);
      expect((svc as any).mmdbReader).toBeNull();
    });

    it('should initialize mmdbReader when DBIP_MMDB_PATH is set and file exists', async () => {
      process.env = { ...originalEnv, DBIP_MMDB_PATH: './valid.mmdb' };

      const module = await Test.createTestingModule({
        providers: [AppService],
      }).compile();

      const svc = module.get<AppService>(AppService);
      expect((svc as any).mmdbReader).not.toBeNull();
      expect((svc as any).mmdbReader.lookup).toBeDefined();
    });
  });
});
