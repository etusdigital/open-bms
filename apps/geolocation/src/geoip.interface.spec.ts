import { IpRequest, LocationResponse, GeoIpLookupResult } from './geoip.interface';

describe('GeoIP Interfaces', () => {
  describe('IpRequest', () => {
    it('should be correctly typed', () => {
      const validRequest: IpRequest = {
        ip: '192.168.1.1',
      };

      expect(validRequest.ip).toBe('192.168.1.1');
    });
  });

  describe('LocationResponse', () => {
    it('should handle successful responses', () => {
      const successResponse: LocationResponse = {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        postalCode: '94105',
        timezone: 'America/Los_Angeles',
        latitude: 37.7749,
        longitude: -122.4194,
        success: true,
      };

      expect(successResponse.success).toBe(true);
      expect(successResponse.error).toBeUndefined();
    });

    it('should handle error responses', () => {
      const errorResponse: LocationResponse = {
        country: '',
        region: '',
        city: '',
        postalCode: '',
        timezone: '',
        latitude: 0,
        longitude: 0,
        success: false,
        error: 'Invalid IP address',
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('Invalid IP address');
    });
  });

  describe('GeoIpLookupResult', () => {
    it('should match expected structure', () => {
      const lookupResult: GeoIpLookupResult = {
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

      expect(lookupResult.country?.iso_code).toBe('US');
      expect(lookupResult.subdivisions?.[0]?.iso_code).toBe('CA');
      expect(lookupResult.city?.names?.en).toBe('San Francisco');
    });
  });
});
