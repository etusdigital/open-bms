import { Observable } from 'rxjs';

export interface Traits {
  asn: number;
  asnOrg: string;
  isp: string;
  organization: string;
  userType: string;
  connectionType: string;
  isAnycast: boolean;
}

export interface GeoData {
  country?: string;
  region?: string;
  city?: string;
  traits?: Traits;
}

export interface GeoProvider {
  lookup(ip: string): Promise<GeoData | null>;
}

export interface LocationResponse {
  country: string;
  region: string;
  city: string;
  postalCode: string;
  timezone: string;
  latitude: number;
  longitude: number;
  success: boolean;
  error?: string;
  traits?: Traits;
}

export interface IpRequest {
  ip: string;
}

export interface GeoIpServiceClient {
  getLocation(data: IpRequest): Observable<LocationResponse>;
}
