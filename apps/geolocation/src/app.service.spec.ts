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

const emptyTraits = {
  asn: 0,
  asnOrg: '',
  isp: '',
  organization: '',
  userType: '',
  connectionType: '',
  isAnycast: false,
};

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
        traits: emptyTraits,
      });
    });

    it('should surface traits (ASN, user_type, org) when present in the lookup', () => {
      const mockResult: GeoIpLookupResult = {
        country: { iso_code: 'US' },
        location: { time_zone: 'America/Los_Angeles', latitude: '37.4056', longitude: '-122.0775' },
        traits: {
          autonomous_system_number: 15169,
          autonomous_system_organization: 'Google LLC',
          isp: 'Google LLC',
          organization: 'Level 3',
          user_type: 'hosting',
          connection_type: 'Corporate',
          is_anycast: true,
        },
      };

      mockLookup.mockReturnValue(mockResult);

      const result = service.getLocation('74.125.1.1');

      expect(result.success).toBe(true);
      expect(result.traits).toEqual({
        asn: 15169,
        asnOrg: 'Google LLC',
        isp: 'Google LLC',
        organization: 'Level 3',
        userType: 'hosting',
        connectionType: 'Corporate',
        isAnycast: true,
      });
    });

    it('should surface Microsoft Exchange traits', () => {
      mockLookup.mockReturnValue({
        country: { iso_code: 'US' },
        traits: {
          autonomous_system_number: 8075,
          autonomous_system_organization: 'Microsoft Corporation',
          isp: 'Microsoft Corporation',
          user_type: 'hosting',
          connection_type: 'Corporate',
        },
      });

      const result = service.getLocation('40.107.1.1');

      expect(result.traits?.asn).toBe(8075);
      expect(result.traits?.asnOrg).toBe('Microsoft Corporation');
      expect(result.traits?.userType).toBe('hosting');
      expect(result.traits?.isAnycast).toBe(false);
    });

    it('should surface residential traits distinctly from hosting', () => {
      mockLookup.mockReturnValue({
        country: { iso_code: 'BR' },
        traits: {
          autonomous_system_number: 28573,
          autonomous_system_organization: 'Claro NXT Telecomunicacoes Ltda',
          user_type: 'residential',
          connection_type: 'Cable/DSL',
        },
      });

      const result = service.getLocation('177.1.1.1');

      expect(result.traits?.userType).toBe('residential');
      expect(result.traits?.asn).toBe(28573);
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
        traits: emptyTraits,
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
        traits: emptyTraits,
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
        traits: emptyTraits,
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
      expect(result.traits).toBeUndefined();
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
      expect(result.traits).toBeUndefined();
      expect(mockLookup).not.toHaveBeenCalled();
    });

    it('should return error when database is not loaded', () => {
      (service as any).mmdbReader = null;

      const result = service.getLocation('8.8.8.8');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not loaded');
      expect(result.traits).toBeUndefined();
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
