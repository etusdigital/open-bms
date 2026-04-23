import { IpRequest, LocationResponse, GeoIpLookupResult, Traits } from './geoip.interface';

describe('GeoIP Interfaces', () => {
  describe('IpRequest', () => {
    it('should be correctly typed', () => {
      const validRequest: IpRequest = {
        ip: '192.168.1.1',
      };

      expect(validRequest.ip).toBe('192.168.1.1');
    });
  });

  describe('Traits', () => {
    it('should be correctly typed', () => {
      const traits: Traits = {
        asn: 15169,
        asn_org: 'Google LLC',
        isp: 'Google LLC',
        organization: 'Level 3',
        user_type: 'hosting',
        connection_type: 'Corporate',
        is_anycast: true,
      };

      expect(traits.asn).toBe(15169);
      expect(traits.user_type).toBe('hosting');
      expect(traits.is_anycast).toBe(true);
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
      expect(successResponse.traits).toBeUndefined();
    });

    it('should handle successful responses with traits', () => {
      const successResponse: LocationResponse = {
        country: 'US',
        region: 'CA',
        city: 'Mountain View',
        postalCode: '94043',
        timezone: 'America/Los_Angeles',
        latitude: 37.4056,
        longitude: -122.0775,
        success: true,
        traits: {
          asn: 15169,
          asn_org: 'Google LLC',
          isp: 'Google LLC',
          organization: 'Level 3',
          user_type: 'hosting',
          connection_type: 'Corporate',
          is_anycast: true,
        },
      };

      expect(successResponse.success).toBe(true);
      expect(successResponse.traits?.asn).toBe(15169);
      expect(successResponse.traits?.user_type).toBe('hosting');
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

    it('should expose the DB-IP traits block', () => {
      const lookupResult: GeoIpLookupResult = {
        country: { iso_code: 'US' },
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

      expect(lookupResult.traits?.autonomous_system_number).toBe(15169);
      expect(lookupResult.traits?.user_type).toBe('hosting');
    });
  });
});
