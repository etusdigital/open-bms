// geolocation.service.ts
import { Injectable } from '@nestjs/common';
import { resolve } from 'path';
import { LocationResponse, GeoIpLookupResult } from './geoip.interface';
import { readFileSync } from 'fs';
import MMDBReader from 'mmdb-reader';
import { Address4, Address6 } from 'ip-address';

@Injectable()
export class AppService {
  private mmdbReader: MMDBReader | null = null;

  constructor() {
    try {
      if (!process.env.DBIP_MMDB_PATH) {
        throw new Error('DBIP_MMDB_PATH is not set');
      }

      const dbBufferDBIP = readFileSync(resolve(__dirname, process.env.DBIP_MMDB_PATH || ''));

      this.mmdbReader = new MMDBReader(dbBufferDBIP);
    } catch (error) {
      console.error('Failed to initialize MMDB reader:', error);
    }
  }

  getLocation(ip: string): LocationResponse {
    if (!this.mmdbReader || !ip) {
      return {
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
    }

    if (!this.isValidIp(ip)) {
      return {
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
    }

    try {
      const response = this.mmdbReader.lookup(ip) as GeoIpLookupResult;

      return {
        country: response?.country?.iso_code || '',
        region: response?.subdivisions?.[0]?.iso_code || '',
        city: response?.city?.names?.en || '',
        postalCode: response?.postal?.code || '',
        timezone: response?.location?.time_zone || '',
        latitude: parseFloat(response?.location?.latitude || '0'),
        longitude: parseFloat(response?.location?.longitude || '0'),
        success: true,
        traits: {
          asn: response?.traits?.autonomous_system_number ?? 0,
          asn_org: response?.traits?.autonomous_system_organization ?? '',
          isp: response?.traits?.isp ?? '',
          organization: response?.traits?.organization ?? '',
          user_type: response?.traits?.user_type ?? '',
          connection_type: response?.traits?.connection_type ?? '',
          is_anycast: response?.traits?.is_anycast ?? false,
        },
      };
    } catch (error) {
      console.error(`Error looking up IP ${ip}:`, error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      return {
        country: '',
        region: '',
        city: '',
        postalCode: '',
        timezone: '',
        latitude: 0,
        longitude: 0,
        success: false,
        error: `Failed to lookup IP: ${errorMsg}`,
      };
    }
  }

  private isValidIp(ip: string): boolean {
    if (Address4.isValid(ip)) {
      return true;
    }

    if (Address6.isValid(ip)) {
      return true;
    }

    return false;
  }
}
